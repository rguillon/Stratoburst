"""Turns a step's gameplay events into SFX events, so sound selection is deterministic (D-29)."""

from scorched_core import protocol
from scorched_core.audio.sfx_id import SfxId
from scorched_core.events.event_ring import EventRing
from scorched_core.protocol import EV_SFX, EVENT_STRIDE
from scorched_core.weapons.pickup_outcome import PickupOutcome
from scorched_core.weapons.weapon_kind import WeaponKind

# Indexed by blast class (BLAST_SMALL 0, MEDIUM 1, LARGE 2, HUGE 3).
_EXPLOSIONS: tuple[SfxId, ...] = (
    SfxId.EXPLODE_SMALL,
    SfxId.EXPLODE_MEDIUM,
    SfxId.EXPLODE_LARGE,
    SfxId.EXPLODE_HUGE,
)

# Frequent sounds: pushed low priority, so they are the first refused when the ring is busy.
_NOISY: frozenset[SfxId] = frozenset({SfxId.VULCAN, SfxId.MISSILE, SfxId.HIT, SfxId.ENEMY_FIRE})

# The stage events that make one fixed sound each, whatever their payload.
_STAGE_SOUNDS: dict[int, SfxId] = {
    protocol.EV_MEDAL: SfxId.MEDAL,
    protocol.EV_EXTEND: SfxId.EXTEND,
    protocol.EV_PART_DESTROYED: SfxId.PART_DESTROY,
    protocol.EV_BOSS_WARNING: SfxId.WARNING,
    protocol.EV_BOSS_PHASE: SfxId.BOSS_PHASE,
    protocol.EV_BOSS_DEFEATED: SfxId.BOSS_DEFEAT,
    protocol.EV_TALLY_LINE: SfxId.TALLY_TICK,
    protocol.EV_STAGE_CLEAR: SfxId.STAGE_CLEAR,
    protocol.EV_GAME_OVER: SfxId.GAME_OVER,
}

_SILENT = -1


def _shot_sound(weapon: int) -> int:
    """The laser hum is state-driven by the beam width, so only bolts and missiles are routed."""
    match weapon:
        case WeaponKind.VULCAN:
            return SfxId.VULCAN
        case WeaponKind.HOMING:
            return SfxId.MISSILE
        case _:
            return _SILENT


def _pickup_sound(outcome: int) -> int:
    match outcome:
        case PickupOutcome.RAISED:
            return SfxId.WEAPON_UP
        case PickupOutcome.SWITCHED:
            return SfxId.WEAPON_SWITCH
        case PickupOutcome.MAXED:
            return SfxId.MAX
        case PickupOutcome.STOCKED:
            return SfxId.BOMB_PICKUP
        case _:
            return _SILENT


def _sound_for(kind: int, a: int, b: int) -> int:
    """Return the sound id an event makes, or -1 when it is silent."""
    sound = _SILENT
    match kind:
        case protocol.EV_EXPLOSION:
            sound = _EXPLOSIONS[min(max(a, 0), len(_EXPLOSIONS) - 1)]
        case protocol.EV_SHOT:
            sound = _shot_sound(a)
        case protocol.EV_HIT:
            sound = SfxId.HIT
        case protocol.EV_PICKUP:
            sound = _pickup_sound(b)
        case protocol.EV_ENEMY_FIRE:
            sound = SfxId.ENEMY_FIRE
        case protocol.EV_PLAYER_HIT:
            sound = SfxId.PLAYER_HIT
        case protocol.EV_PLAYER_DEATH:
            sound = SfxId.DEATH
        case protocol.EV_RESPAWN:
            sound = SfxId.RESPAWN
        case protocol.EV_BOMB_LAUNCH:
            sound = SfxId.BOMB_LAUNCH
        case protocol.EV_BOMB_DETONATE:
            sound = SfxId.BOMB_BLAST
        case protocol.EV_DEATHBOMB_SAVE:
            sound = SfxId.DEATHBOMB
        case _:
            sound = _STAGE_SOUNDS.get(kind, _SILENT)
    return sound


def route_sfx(events: EventRing, start: int, end: int) -> int:
    """Push one SFX event per audible event in ``events[start:end]``; return how many landed.

    The slice end is fixed by the caller, so the router never reads the SFX events it pushes.
    Noisy sounds are pushed low priority and may be refused when the ring is busy.
    """
    buf = events.buf
    pushed = 0
    for i in range(start, end):
        base = i * EVENT_STRIDE
        sound = _sound_for(int(buf[base]), int(buf[base + 3]), int(buf[base + 4]))
        if sound >= 0 and events.push(
            EV_SFX, buf[base + 1], buf[base + 2], sound, low=sound in _NOISY
        ):
            pushed += 1
    return pushed
