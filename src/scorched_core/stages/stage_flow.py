"""The stage's flow state machine: where a run is between play and game over."""

from dataclasses import dataclass

from scorched_core.entities.player_life import PlayerLife
from scorched_core.entities.player_phase import PlayerPhase
from scorched_core.events.event_ring import EventRing
from scorched_core.protocol import EV_GAME_OVER
from scorched_core.scoring.score_keeper import ScoreKeeper
from scorched_core.stages.flow_state import FlowState


@dataclass(slots=True)
class StageFlow:
    """PLAY until the last ship is gone, then GAME_OVER; later plans add the other states.

    It reads the player's life and score by reference and never owns them. ``timer`` counts the
    steps spent in the current state after its first, and ``save_requested`` is raised once on
    entering GAME_OVER for the high-score adapter, which clears it through the game.
    """

    life: PlayerLife
    score: ScoreKeeper
    events: EventRing
    state: FlowState = FlowState.PLAY
    timer: int = 0
    save_requested: bool = False

    @property
    def spawning(self) -> bool:
        """Return whether the stage director may still spawn enemies."""
        return self.state is not FlowState.GAME_OVER

    def step(self) -> None:
        """Advance one live 60 Hz step."""
        match self.state:
            case FlowState.PLAY:
                if self.life.phase is PlayerPhase.OUT:
                    self._game_over()
            case FlowState.GAME_OVER:
                self.timer += 1
            case unknown:
                msg = f"unknown flow state {unknown}"
                raise ValueError(msg)

    def reset(self) -> None:
        """Return to PLAY with nothing requested (a new run)."""
        self.state = FlowState.PLAY
        self.timer = 0
        self.save_requested = False

    def _game_over(self) -> None:
        """Enter GAME_OVER: one event with the final score and the record flag, one save request."""
        self.state = FlowState.GAME_OVER
        self.timer = 0
        self.save_requested = True
        score = self.score
        self.events.push(EV_GAME_OVER, 0.0, 0.0, score.score, 1 if score.new_record else 0)
