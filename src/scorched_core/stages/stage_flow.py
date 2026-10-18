"""The stage's flow state machine: where a run is between play and game over."""

from dataclasses import dataclass, field
from typing import Final

from scorched_core.bosses.boss_controller import BossController
from scorched_core.entities.player_life import PlayerLife
from scorched_core.entities.player_phase import PlayerPhase
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import EBULLET_GAME_CAP, EV_BOSS_WARNING, EV_GAME_OVER, EV_STAGE_START
from scorched_core.scoring.score_keeper import ScoreKeeper
from scorched_core.stages.flow_state import FlowState
from scorched_core.stages.stage_data import StageData
from scorched_core.stages.terrain_scroll import TerrainScroll
from scorched_core.tuning import (
    BOSS_CRAWL_SPEED,
    BOSS_TRIGGER_WINDOW,
    INTRO_TICKS,
    MIDBOSS_CRAWL_SPEED,
    MIDBOSS_TRIGGER_WINDOW,
    SCROLL_SPEED,
    WARNING_TICKS,
)

_NO_SPAWN_STATES: Final = frozenset(
    {FlowState.WARNING, FlowState.BOSS, FlowState.CLEAR, FlowState.GAME_OVER}
)
MIDBOSS_SLOT = 1  # the boss slot the header and the boss bar know the mid-boss by
BOSS_SLOT = 2  # and the one the bomber has


@dataclass(slots=True)
class StageFlow:
    """INTRO, PLAY, the MIDBOSS fight inside it, the boss's WARNING, BOSS and CLEAR, GAME_OVER.

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
    on the field without points and clears the enemy bullets. Game over wins over every one of
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
    boss: BossController | None = field(default=None, init=False)
    boss_destroyed: bool = field(default=False, init=False)
    _midboss_done: bool = field(default=False, init=False, repr=False)

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
            case _:  # CLEAR holds: the field is empty and nothing can hit the ship
                self.timer += 1

    def reset(self) -> None:
        """Return to the INTRO with nothing requested and no fight under way (a new run)."""
        self.state = FlowState.INTRO
        self.timer = 0
        self.save_requested = False
        self.boss = None
        self.boss_destroyed = False
        self._midboss_done = False

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

    def _game_over(self) -> None:
        """Enter GAME_OVER: one event with the final score and the record flag, one save request.

        Any running fight is dropped, so no controller outlives the run (T-03-22).
        """
        self.state = FlowState.GAME_OVER
        self.timer = 0
        self.save_requested = True
        self.boss = None
        score = self.score
        self.events.push(EV_GAME_OVER, 0.0, 0.0, score.score, 1 if score.new_record else 0)
