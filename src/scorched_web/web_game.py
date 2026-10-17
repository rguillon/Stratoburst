"""The object JS holds: a Game plus the sink that publishes its buffers."""

from typing import Any

from scorched_core.game.game import Game
from scorched_web.bridge.render_sink import RenderSink


class WebGame:
    """Browser-facing facade over :class:`Game`."""

    __slots__ = ("_game", "_sink")

    def __init__(self, game: Game, sink: RenderSink) -> None:
        self._game = game
        self._sink = sink

    def manifest(self) -> dict[str, object]:
        """Return the boundary layout."""
        return self._game.manifest()

    def attach(self, name: str, target: Any) -> None:  # noqa: ANN401 - duck-typed JsProxy
        """Bind a JS typed array to a channel."""
        self._sink.attach(name, target)

    def set_paused(self, paused: bool) -> None:
        """Skeleton: pausing is not wired yet."""

    def tick(  # noqa: PLR0913, PLR0917 - frozen boundary signature
        self,
        dt_ms: float,
        buttons: int,
        move_x: float,
        move_y: float,
        drag_x: float,
        drag_y: float,
    ) -> int:
        """Advance one frame, publish the buffers, and return the steps that ran."""
        steps = self._game.tick(dt_ms, buttons, move_x, move_y, drag_x, drag_y)
        self._sink.flush(bulk=steps > 0)
        return steps
