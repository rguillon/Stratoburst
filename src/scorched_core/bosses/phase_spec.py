"""One phase of a boss fight as frozen data (ENMY-06, D-10, D-11)."""

from dataclasses import dataclass

from scorched_core.bosses.emitter_spec import EmitterSpec
from scorched_core.entities.enemy_kind import EnemyKind


@dataclass(frozen=True, slots=True)
class PhaseSpec:
    """How the boss attacks from the moment its hull health falls to ``hp_frac``.

    ``emitters`` fire in the order listed. The hull sways ``sway_x`` and ``sway_y`` units around
    its hold point over ``sway_period`` steps, and ``hull_kind`` (when given) swaps the hull row's
    kind on entering the phase, so the model can change as the boss is worn down.
    """

    hp_frac: float
    emitters: tuple[EmitterSpec, ...]
    sway_x: float = 0.0
    sway_y: float = 0.0
    sway_period: int = 240
    hull_kind: EnemyKind | None = None

    def __post_init__(self) -> None:
        """Reject a threshold outside (0, 1] and a sway that could not repeat."""
        if not 0.0 < self.hp_frac <= 1.0:
            msg = f"hp_frac must be in (0, 1], got {self.hp_frac}"
            raise ValueError(msg)
        if self.sway_period < 1:
            msg = f"sway_period must be at least 1 step, got {self.sway_period}"
            raise ValueError(msg)
