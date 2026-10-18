"""The stage's flow state machine: where a run is between play and game over."""

from dataclasses import dataclass, field

from scorched_core.bosses.boss_controller import BossController
from scorched_core.entities.player_life import PlayerLife
from scorched_core.entities.player_phase import PlayerPhase
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import EV_GAME_OVER, EV_STAGE_START
from scorched_core.scoring.score_keeper import ScoreKeeper
from scorched_core.stages.flow_state import FlowState
from scorched_core.stages.stage_data import StageData
from scorched_core.stages.terrain_scroll import TerrainScroll
from scorched_core.tuning import (
    INTRO_TICKS,
    MIDBOSS_CRAWL_SPEED,
    MIDBOSS_TRIGGER_WINDOW,
    SCROLL_SPEED,
)

MIDBOSS_SLOT = 1  # the boss slot the header and the boss bar know the mid-boss by


@dataclass(slots=True)
class StageFlow:
    """INTRO, PLAY, the MIDBOSS fight inside it, then GAME_OVER; later plans add the others.

    It reads the player's life and score by reference and never owns them. ``timer`` counts the
    steps spent in the current state (INTRO: including the first; GAME_OVER: after the first),
    and ``save_requested`` is raised once on entering GAME_OVER for the high-score adapter, which
    clears it through the game. ``stage_number`` is announced by the STAGE_START event that the
    first INTRO step pushes.

    The flow also holds the ``terrain`` it slows for a boss, the ``enemies`` pool a boss spawns
    into and the ``stage`` that names the fights. It owns the running ``boss`` controller: the
    game steps it and settles it, the flow starts it at its marker, drops it when it is gone and
    never starts a fight twice in one run.
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
    stage: StageData | None = None
    boss: BossController | None = field(default=None, init=False)
    _midboss_done: bool = field(default=False, init=False, repr=False)

    @property
    def spawning(self) -> bool:
        """Return whether the stage director may still spawn enemies."""
        return self.state is not FlowState.GAME_OVER

    @property
    def progress(self) -> float:
        """Return how far through the INTRO the stage is, 0 to 1; 0 in every other state."""
        if self.state is FlowState.INTRO:
            return self.timer / INTRO_TICKS
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
            case FlowState.PLAY:
                if self.life.phase is PlayerPhase.OUT:
                    self._game_over()
                else:
                    self._start_midboss_at_its_marker()
            case FlowState.MIDBOSS:
                if self.life.phase is PlayerPhase.OUT:
                    self._game_over()
                elif self.boss is None or self.boss.gone:
                    self._end_midboss()
            case FlowState.GAME_OVER:
                self.timer += 1
            case unknown:
                msg = f"unknown flow state {unknown}"
                raise ValueError(msg)

    def reset(self) -> None:
        """Return to the INTRO with nothing requested and no fight under way (a new run)."""
        self.state = FlowState.INTRO
        self.timer = 0
        self.save_requested = False
        self.boss = None
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
