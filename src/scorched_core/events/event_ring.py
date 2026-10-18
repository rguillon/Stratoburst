"""Preallocated per-tick event buffer that crosses the boundary as one float32 channel."""

from array import array
from dataclasses import dataclass, field

from scorched_core.protocol import EVENT_CAP, EVENT_SOFT_CAP, EVENT_STRIDE


@dataclass(slots=True)
class EventRing:
    """Up to ``EVENT_CAP`` events per tick, stored flat as ``kind, x, y, a, b, c`` records.

    The ring is cleared at the start of every tick, so JS sees each event exactly once.
    A refused event bumps the cumulative ``dropped`` counter instead of growing the buffer, and
    ``dropped_high`` as well when it was not low priority: a lost kill or boss event, which a
    full-stage run must never see.
    """

    buf: array = field(init=False)
    n: int = field(default=0, init=False)
    dropped: int = field(default=0, init=False)
    dropped_high: int = field(default=0, init=False)

    def __post_init__(self) -> None:
        self.buf = array("f", bytes(4 * EVENT_STRIDE * EVENT_CAP))

    def clear(self) -> None:
        """Forget this tick's events; ``dropped`` and ``dropped_high`` stay cumulative."""
        self.n = 0

    def push(  # noqa: PLR0913, PLR0917 - an event record is six numbers
        self,
        kind: int,
        x: float,
        y: float,
        a: float = 0.0,
        b: float = 0.0,
        c: float = 0.0,
        *,
        low: bool = False,
    ) -> bool:
        """Queue one event; return False (and count a drop) when it is refused.

        A ``low`` event is refused from ``EVENT_SOFT_CAP`` on, which keeps room for the rest.
        """
        i = self.n
        if i >= EVENT_CAP or (low and i >= EVENT_SOFT_CAP):
            self.dropped += 1
            if not low:
                self.dropped_high += 1
            return False
        buf = self.buf
        base = i * EVENT_STRIDE
        buf[base] = kind
        buf[base + 1] = x
        buf[base + 2] = y
        buf[base + 3] = a
        buf[base + 4] = b
        buf[base + 5] = c
        self.n = i + 1
        return True
