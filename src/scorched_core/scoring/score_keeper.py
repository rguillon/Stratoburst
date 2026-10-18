"""The run's score, lives and high score, with the extra-ship thresholds."""

from dataclasses import dataclass, field

from scorched_core.events.event_ring import EventRing
from scorched_core.tuning import EXTEND_FIRST, LIVES_START, SCORE_CAP


@dataclass(slots=True)
class ScoreKeeper:
    """Score and lives of one run.

    ``score`` is a Python int clamped at ``SCORE_CAP``, so the float32 header slot always holds it
    exactly. ``high_score`` is the best seen so far, never below the best at the start of the run
    (``best_at_start``, fed by the caller); ``new_record`` is true once the score passes that best.
    """

    score: int = 0
    lives: int = LIVES_START
    high_score: int = 0
    best_at_start: int = field(default=0, init=False)
    next_extend: int = EXTEND_FIRST

    def __post_init__(self) -> None:
        self.best_at_start = self.high_score

    @property
    def new_record(self) -> bool:
        """Return whether the score is above the best this run started with."""
        return self.score > self.best_at_start

    def award(self, points: int, events: EventRing, x: float, y: float) -> int:  # noqa: ARG002
        """Add ``points`` (clamped at the cap), raise the high score; return the extends granted.

        ``events``, ``x`` and ``y`` announce an extend where the points were earned.
        """
        self.score = min(self.score + points, SCORE_CAP)
        self.high_score = max(self.high_score, self.score)
        return 0

    def reset_run(self, lives: int = LIVES_START) -> None:
        """Start a new run: zero score, ``lives`` ships, the first threshold, today's best kept."""
        self.score = 0
        self.lives = lives
        self.next_extend = EXTEND_FIRST
        self.best_at_start = self.high_score
