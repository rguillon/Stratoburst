"""The stage's flow state machine: where a run is between play and game over."""

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Final

from scorched_core.bosses.boss_controller import BossController
from scorched_core.entities.player_life import PlayerLife
from scorched_core.entities.player_phase import PlayerPhase
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import (
    EBULLET_GAME_CAP,
    EV_BOSS_WARNING,
    EV_GAME_OVER,
    EV_STAGE_CLEAR,
    EV_STAGE_START,
    EV_TALLY_LINE,
    PLAYFIELD_H,
    PLAYFIELD_W,
)
from scorched_core.scoring.medal_chain import MedalChain
from scorched_core.scoring.score_keeper import ScoreKeeper
from scorched_core.scoring.stage_tally import LINES, StageTally
from scorched_core.stages.flow_state import FlowState
from scorched_core.stages.stage_data import StageData
from scorched_core.stages.terrain_scroll import TerrainScroll
from scorched_core.tuning import (
    BOSS_CRAWL_SPEED,
    BOSS_TRIGGER_WINDOW,
    CLEAR_TICKS,
    INTRO_TICKS,
    MIDBOSS_CRAWL_SPEED,
    MIDBOSS_TRIGGER_WINDOW,
    SCROLL_SPEED,
    STAGE_CLEAR_TICKS,
    TALLY_HOLD_TICKS,
    TALLY_LINE_TICKS,
    WARNING_TICKS,
)

_NO_SPAWN_STATES: Final = frozenset(
    {
        FlowState.WARNING,
        FlowState.BOSS,
        FlowState.CLEAR,
        FlowState.TALLY,
        FlowState.STAGE_CLEAR,
        FlowState.GAME_OVER,
    }
)
_LAST_LINE_AT: Final = (LINES - 1) * TALLY_LINE_TICKS  # the tally step that reveals the fourth line
_TALLY_X: Final = PLAYFIELD_W / 2  # where an extend earned by a tally line is announced
_TALLY_Y: Final = PLAYFIELD_H / 2
MIDBOSS_SLOT = 1  # the boss slot the header and the boss bar know the mid-boss by
BOSS_SLOT = 2  # and the one the bomber has


def _no_bombs() -> int:
    """Stand-in bomb stock for a flow that is not wired to a game."""
    return 0


def _no_restart() -> None:
    """Stand-in stage restart for a flow that is not wired to a game."""


@dataclass(slots=True)
class StageFlow:
    """INTRO, PLAY, the MIDBOSS fight inside it, the boss's WARNING, BOSS, CLEAR, TALLY, GAME_OVER.

    It reads the player's life and score by reference and never owns them. ``timer`` counts the
    steps spent in the current state (INTRO: including the first; GAME_OVER: after the first),
    and ``save_requested`` is raised once on entering GAME_OVER for the high-score adapter, which
    clears it through the game. ``stage_number`` is announced by the STAGE_START event that the
    first INTRO step pushes.

    The flow also holds the ``terrain`` it slows for a boss, the ``enemies`` pool a boss spawns
    into, the ``ebullets`` it clears and the ``stage`` that names the fights. It owns the running
    ``boss`` controller: the game steps it and settles it, the flow starts it at its marker, drops
    it when it is gone and never starts a mid-boss fight twice in one run.

    The boss marker raises a WARNING (one BOSS_WARNING event, the scroll slowing to a crawl and
    the director stopping); ``timer`` counts its steps and ``progress`` rises 0 to 1. After
    ``WARNING_TICKS`` the bomber starts (BOSS, slot 2). When it is gone the flow enters CLEAR,
    records in ``boss_destroyed`` whether it was shot down or got away, blows up every enemy still
    on the field without points and clears the enemy bullets. After ``CLEAR_TICKS`` the TALLY works
    the stage's four bonus lines out from ``boss_destroyed``, the ``chain`` medals caught since the
    INTRO, the ships lost since the INTRO and the bombs ``get_bombs`` reports (a callable, because
    the game replaces its Bomb object on a restart), then reveals one line every
    ``TALLY_LINE_TICKS``, pays each through the score keeper, and after ``TALLY_HOLD_TICKS`` moves
    on to STAGE_CLEAR. That pushes one STAGE_CLEAR event and raises ``save_requested``; after
    ``STAGE_CLEAR_TICKS`` it calls ``on_stage_restart`` (the game puts the stage back to its start)
    and the flow returns to the INTRO for the next loop (D-27). Game over wins over every one of
    these states.
    """

    life: PlayerLife
    score: ScoreKeeper
    events: EventRing
    state: FlowState = FlowState.INTRO
    timer: int = 0
    save_requested: bool = False
    stage_number: int = 1
    terrain: TerrainScroll = field(default_factory=TerrainScroll)
    enemies: EnemyPool = field(default_factory=EnemyPool)
    ebullets: BulletPool = field(default_factory=lambda: BulletPool(EBULLET_GAME_CAP))
    stage: StageData | None = None
    chain: MedalChain = field(default_factory=MedalChain)
    get_bombs: Callable[[], int] = _no_bombs
    on_stage_restart: Callable[[], None] = _no_restart
    tally: StageTally = field(default_factory=StageTally, init=False)
    boss: BossController | None = field(default=None, init=False)
    boss_destroyed: bool = field(default=False, init=False)
    _midboss_done: bool = field(default=False, init=False, repr=False)
    _deaths_at_start: int = field(default=0, init=False, repr=False)

    @property
    def spawning(self) -> bool:
        """Return whether the stage director may still spawn enemies.

        The boss room holds nothing new: the director stops from the WARNING to the end.
        """
        return self.state not in _NO_SPAWN_STATES

    @property
    def progress(self) -> float:
        """Return how far through the INTRO or the WARNING the stage is, 0 to 1; 0 elsewhere."""
        if self.state is FlowState.INTRO:
            return self.timer / INTRO_TICKS
        if self.state is FlowState.WARNING:
            return self.timer / WARNING_TICKS
        return 0.0

    def step(self) -> None:
        """Advance one live 60 Hz step."""
        match self.state:
            case FlowState.INTRO:
                if self.timer == 0:
                    self.events.push(EV_STAGE_START, 0.0, 0.0, self.stage_number)
                    self._deaths_at_start = self.life.deaths  # the tally counts from here
                    self.chain.stage_reset()
                self.timer += 1
                if self.timer >= INTRO_TICKS:
                    self.state = FlowState.PLAY
                    self.timer = 0
            case FlowState.GAME_OVER:
                self.timer += 1
            case (
                FlowState.PLAY
                | FlowState.MIDBOSS
                | FlowState.WARNING
                | FlowState.BOSS
                | FlowState.CLEAR
                | FlowState.TALLY
                | FlowState.STAGE_CLEAR
            ):
                if self.life.phase is PlayerPhase.OUT:  # game over wins over every run state
                    self._game_over()
                else:
                    self._step_run()
            case unknown:
                msg = f"unknown flow state {unknown}"
                raise ValueError(msg)

    def _step_run(self) -> None:
        """Advance a state that is part of the run: the ship is not out, so the stage goes on."""
        match self.state:
            case FlowState.PLAY:
                self._start_midboss_at_its_marker()
                if self.state is FlowState.PLAY:
                    self._warn_at_the_boss_marker()
            case FlowState.MIDBOSS:
                if self.boss is None or self.boss.gone:
                    self._end_midboss()
            case FlowState.WARNING:
                self._count_the_warning()
            case FlowState.BOSS:
                if self.boss is None or self.boss.gone:
                    self._end_boss()
            case FlowState.CLEAR:  # the field is empty and nothing can hit the ship
                self._count_the_clear()
            case FlowState.TALLY:
                self._step_tally()
            case _:  # STAGE_CLEAR
                self._step_stage_clear()

    def reset(self) -> None:
        """Return to the INTRO with nothing requested and no fight under way (a new run)."""
        self._rewind()
        self.save_requested = False

    def _rewind(self) -> None:
        """Return to the INTRO with no fight under way and no tally; a request stays as it is."""
        self.state = FlowState.INTRO
        self.timer = 0
        self.boss = None
        self.boss_destroyed = False
        self._midboss_done = False
        self.tally.reset()

    def _start_midboss_at_its_marker(self) -> None:
        """Start the mid-boss once, as the scroll crosses its marker; a refused spawn retries.

        The trigger window keeps a run that was jumped past the marker (``?at=boss``) from
        starting a fight it skipped.
        """
        stage = self.stage
        if stage is None or stage.midboss is None or self._midboss_done:
            return
        beyond = self.terrain.distance - stage.marker("midboss")
        if not 0.0 <= beyond < MIDBOSS_TRIGGER_WINDOW:
            return
        controller = BossController(stage.midboss, MIDBOSS_SLOT)
        if not controller.start(self.enemies):
            return
        self.boss = controller
        self._midboss_done = True
        self.state = FlowState.MIDBOSS
        self.timer = 0
        self.terrain.set_target(MIDBOSS_CRAWL_SPEED)

    def _end_midboss(self) -> None:
        """The train is gone, destroyed or retreated: play resumes and the scroll speeds back up."""
        self.boss = None
        self.state = FlowState.PLAY
        self.timer = 0
        self.terrain.set_target(SCROLL_SPEED)

    def _warn_at_the_boss_marker(self) -> None:
        """Raise the WARNING as the scroll crosses the boss marker; a jumped-past marker is skipped.

        The scroll slows to the boss crawl at once (it keeps moving, D-06) and one BOSS_WARNING
        event announces it. The trigger window keeps a debug jump past the marker honest.
        """
        stage = self.stage
        if stage is None or stage.boss is None:
            return
        beyond = self.terrain.distance - stage.marker("boss")
        if not 0.0 <= beyond < BOSS_TRIGGER_WINDOW:
            return
        self.state = FlowState.WARNING
        self.timer = 0
        self.terrain.set_target(BOSS_CRAWL_SPEED)
        self.events.push(EV_BOSS_WARNING, 0.0, 0.0)

    def _count_the_warning(self) -> None:
        """Count one WARNING step; when it is over, start the bomber (a refused spawn retries).

        The clock stops at ``WARNING_TICKS``, so the bar stays full while a crowded pool makes the
        bomber wait for room.
        """
        stage = self.stage
        if self.timer < WARNING_TICKS:
            self.timer += 1
        if self.timer < WARNING_TICKS or stage is None or stage.boss is None:
            return
        controller = BossController(stage.boss, BOSS_SLOT)
        if not controller.start(self.enemies):
            return
        self.boss = controller
        self.state = FlowState.BOSS
        self.timer = 0

    def _end_boss(self) -> None:
        """The bomber is gone, shot down or retreated: record which, and clear the field.

        Every enemy still on the field explodes without points and the enemy bullets are cleared,
        so nothing can hit the ship while the clear plays out.
        """
        self.boss_destroyed = self.boss is not None and self.boss.destroyed
        self.boss = None
        self.state = FlowState.CLEAR
        self.timer = 0
        self.enemies.detonate_all(self.events)
        self.ebullets.clear()

    def _count_the_clear(self) -> None:
        """Count one CLEAR step; when the hold is over, work the tally out and begin it."""
        self.timer += 1
        if self.timer < CLEAR_TICKS:
            return
        self.tally.compute(
            self.boss_destroyed,
            self.chain.collected,
            self.life.deaths - self._deaths_at_start,
            self.get_bombs(),
        )
        self.state = FlowState.TALLY
        self.timer = 0

    def _step_tally(self) -> None:
        """Reveal and pay a line on every ``TALLY_LINE_TICKS``th step, then hold after the last.

        The first line comes on the first TALLY step. Each line pushes one TALLY_LINE event and goes
        through the score keeper, so the score cap and the extra-ship rules apply to it.
        """
        tally = self.tally
        if tally.revealed < LINES and self.timer == tally.revealed * TALLY_LINE_TICKS:
            index, amount = tally.reveal_next()
            self.events.push(EV_TALLY_LINE, 0.0, 0.0, index, amount)
            self.score.award(amount, self.events, _TALLY_X, _TALLY_Y)
        self.timer += 1
        if tally.revealed == LINES and self.timer > _LAST_LINE_AT + TALLY_HOLD_TICKS:
            self.state = FlowState.STAGE_CLEAR
            self.timer = 0
            self.events.push(EV_STAGE_CLEAR, 0.0, 0.0, self.stage_number)
            self.save_requested = True

    def _step_stage_clear(self) -> None:
        """Count one STAGE CLEAR step; when it is over, the stage starts again from its beginning.

        The game puts the world back (``on_stage_restart``), then the flow returns to the INTRO.
        A save request raised on entering stays up for the high-score adapter to clear.
        """
        self.timer += 1
        if self.timer >= STAGE_CLEAR_TICKS:
            self.on_stage_restart()
            self._rewind()

    def _game_over(self) -> None:
        """Enter GAME_OVER: one event with the final score and the record flag, one save request.

        Any running fight is dropped, so no controller outlives the run (T-03-22).
        """
        self.state = FlowState.GAME_OVER
        self.timer = 0
        self.save_requested = True
        self.boss = None
        self.tally.reset()
        score = self.score
        self.events.push(EV_GAME_OVER, 0.0, 0.0, score.score, 1 if score.new_record else 0)
