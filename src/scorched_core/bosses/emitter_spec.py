"""One boss gun as frozen data: which pattern, from where (ENMY-06)."""

from dataclasses import dataclass, field

from scorched_core.patterns.pattern_library import pattern_index


@dataclass(frozen=True, slots=True)
class EmitterSpec:
    """A muzzle that plays one bullet pattern for as long as its phase lasts.

    ``pattern`` names an entry of the pattern registry and resolves once, on construction, to
    ``pattern_id``, the index the controller uses: an unknown name is a ValueError. ``part`` is
    the index of the part the gun is mounted on (-1 for the hull) and ``(dx, dy)`` the muzzle
    offset from that part's centre, or from the hull's. A part's gun stops when its part is a stump.
    """

    pattern: str
    part: int = -1
    dx: float = 0.0
    dy: float = 0.0
    pattern_id: int = field(init=False)

    def __post_init__(self) -> None:
        """Resolve the pattern name now, so a typo fails at import and never in the step loop."""
        object.__setattr__(self, "pattern_id", pattern_index(self.pattern))
