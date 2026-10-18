"""Turns a step's gameplay events into SFX events, so sound selection is deterministic (D-29)."""

from scorched_core.audio.sfx_id import SfxId
from scorched_core.events.event_ring import EventRing
from scorched_core.protocol import EV_EXPLOSION, EV_SFX, EVENT_STRIDE

# Indexed by blast class (BLAST_SMALL 0, MEDIUM 1, LARGE 2).
_EXPLOSIONS: tuple[SfxId, ...] = (SfxId.EXPLODE_SMALL, SfxId.EXPLODE_MEDIUM, SfxId.EXPLODE_LARGE)


def _sound_for(kind: int, blast: int) -> int:
    """Return the sound id an event makes, or -1 when it is silent."""
    if kind == EV_EXPLOSION:
        return _EXPLOSIONS[min(max(blast, 0), len(_EXPLOSIONS) - 1)]
    return -1


def route_sfx(events: EventRing, start: int, end: int) -> int:
    """Push one SFX event per audible event in ``events[start:end]``; return how many landed.

    The slice end is fixed by the caller, so the router never reads the SFX events it pushes.
    """
    buf = events.buf
    pushed = 0
    for i in range(start, end):
        base = i * EVENT_STRIDE
        sound = _sound_for(int(buf[base]), int(buf[base + 3]))
        if sound >= 0 and events.push(EV_SFX, buf[base + 1], buf[base + 2], sound):
            pushed += 1
    return pushed
