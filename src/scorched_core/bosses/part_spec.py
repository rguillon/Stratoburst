"""One destructible boss part as frozen data (ENMY-07)."""

from dataclasses import dataclass

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.tuning import BOSS_MAX_RADIUS, ENEMY_RADIUS


@dataclass(frozen=True, slots=True)
class PartSpec:
    """A turret, engine or gun car riding on the hull.

    ``kind`` is the row's enemy kind and ``(dx, dy)`` its offset from the hull centre. ``hp`` is
    its own hit points and ``points`` what destroying it pays. ``stump_kind`` is the kind the row
    becomes once destroyed: the stump stays on the hull for the rest of the fight (D-14).
    ``radius`` overrides the kind's table radius. Every field is validated on construction, and
    the radius may not exceed ``BOSS_MAX_RADIUS`` so the 3x3 broadphase stays exact.
    """

    kind: EnemyKind
    dx: float
    dy: float
    hp: int
    points: int
    stump_kind: EnemyKind
    radius: float | None = None

    def __post_init__(self) -> None:
        """Reject a part that could not be hit, paid or placed in the grid."""
        if self.hp < 1:
            msg = f"a part needs at least 1 hp, got {self.hp}"
            raise ValueError(msg)
        if self.points < 0:
            msg = f"a part cannot pay negative points, got {self.points}"
            raise ValueError(msg)
        if not 0.0 < self.effective_radius <= BOSS_MAX_RADIUS:
            msg = f"part radius must be in (0, {BOSS_MAX_RADIUS}], got {self.effective_radius}"
            raise ValueError(msg)

    @property
    def effective_radius(self) -> float:
        """Return the radius the row is spawned with: the override, else the kind's table value."""
        return ENEMY_RADIUS[self.kind] if self.radius is None else self.radius
