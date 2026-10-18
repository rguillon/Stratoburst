"""The only symbol the JS side imports."""

import math
from typing import Any, Final

from scorched_core.game.fault_mode import FaultMode
from scorched_core.game.game import Game
from scorched_core.stages.stage_1 import STAGE_1
from scorched_core.tuning import BOMB_MAX_STOCK, BOMB_START_STOCK, MAX_LEVEL
from scorched_core.weapons.weapon_kind import WeaponKind
from scorched_web.bridge.render_sink import RenderSink
from scorched_web.web_game import WebGame

_WEAPONS: Final = {kind.name.lower(): kind for kind in WeaponKind}


def create_game(options: Any = None) -> WebGame:  # noqa: ANN401 - dict or JsProxy
    """Build a WebGame from ``options`` (a dict, a JsProxy with ``to_py``, or None).

    Stage 1 is the default game (D-29); ``gallery`` (a real ``True``) brings back the Phase 2
    shooting gallery.
    """
    if options is not None and hasattr(options, "to_py"):
        options = options.to_py()
    opts = options or {}
    game = Game(
        seed=int(opts.get("seed", 1)),
        stress=int(opts.get("stress", 0)),
        fault=_fault_mode(opts.get("crash")),
        weapon=_weapon(opts.get("weapon")),
        level=_level(opts.get("level")),
        god=_flag(opts.get("god")),
        bombs=_bombs(opts.get("bombs")),
        stage=None if _flag(opts.get("gallery")) else STAGE_1,
    )
    return WebGame(game, RenderSink(game.buffers))


def _fault_mode(value: object) -> FaultMode:
    """The requested fault; an unknown value means no fault (the URL is untrusted input)."""
    try:
        return FaultMode(value)
    except ValueError:
        return FaultMode.NONE


def _weapon(value: object) -> WeaponKind:
    """The requested starting weapon; only the three lowercase names count (untrusted input)."""
    if isinstance(value, str):
        return _WEAPONS.get(value, WeaponKind.VULCAN)
    return WeaponKind.VULCAN


def _level(value: object) -> int:
    """The requested starting level, truncated and clamped to 1..MAX_LEVEL; junk means 1."""
    if isinstance(value, bool) or not isinstance(value, int | float | str):
        return 1
    try:
        number = float(value)
    except ValueError:
        return 1
    if not math.isfinite(number):
        return 1
    return min(max(int(number), 1), MAX_LEVEL)


def _bombs(value: object) -> int:
    """The requested starting bomb stock, truncated and clamped to 0..7; junk means 3."""
    if isinstance(value, bool) or not isinstance(value, int | float | str):
        return BOMB_START_STOCK
    try:
        number = float(value)
    except ValueError:
        return BOMB_START_STOCK
    if not math.isfinite(number):
        return BOMB_START_STOCK
    return min(max(int(number), 0), BOMB_MAX_STOCK)


def _flag(value: object) -> bool:
    """A boolean test flag; only a real ``True`` counts (the URL is untrusted input)."""
    return value is True
