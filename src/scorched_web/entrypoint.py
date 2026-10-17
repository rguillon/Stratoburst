"""The only symbol the JS side imports."""

from typing import Any

from scorched_core.game.game import Game
from scorched_web.bridge.render_sink import RenderSink
from scorched_web.web_game import WebGame


def create_game(options: Any = None) -> WebGame:  # noqa: ANN401 - dict or JsProxy
    """Build a WebGame from ``options`` (a dict, a JsProxy with ``to_py``, or None)."""
    if options is not None and hasattr(options, "to_py"):
        options = options.to_py()
    opts = options or {}
    game = Game(seed=int(opts.get("seed", 1)), stress=int(opts.get("stress", 0)))
    return WebGame(game, RenderSink(game.buffers))
