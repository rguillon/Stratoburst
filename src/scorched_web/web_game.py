"""The object JS holds: a Game plus the sink that publishes its buffers."""

from typing import Any

from scorched_core.game.game import Game
from scorched_web.bridge.high_score_store import HighScoreStore
from scorched_web.bridge.render_sink import RenderSink


class WebGame:
    """Browser-facing facade over :class:`Game`."""

    __slots__ = ("_game", "_sink", "_store")

    def __init__(self, game: Game, sink: RenderSink, store: HighScoreStore | None = None) -> None:
        self._game = game
        self._sink = sink
        self._store = store

    def manifest(self) -> dict[str, object]:
        """Return the boundary layout."""
        return self._game.manifest()

    def attach(self, name: str, target: Any) -> None:  # noqa: ANN401 - duck-typed JsProxy
        """Bind a JS typed array to a channel."""
        self._sink.attach(name, target)

    def set_paused(self, paused: bool) -> None:
        """Pause or resume now and publish the header so JS sees the flag without a tick."""
        self._game.set_paused(paused)
        self._sink.flush(bulk=False)
        if paused:
            self._save_best()

    def restart(self) -> None:
        """Start a fresh run now and publish the header and every channel (D-28)."""
        self._game.restart()
        self._sink.flush(bulk=True)

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
        was_paused = self._game.paused
        steps = self._game.tick(dt_ms, buttons, move_x, move_y, drag_x, drag_y)
        self._sink.flush(bulk=steps > 0)
        if self._game.save_requested:
            self._save_best()
            self._game.clear_save_request()
        elif self._game.paused and not was_paused:
            self._save_best()
        return steps

    def _save_best(self) -> None:
        """Store the high score at a natural flush point (never per frame)."""
        if self._store is not None:
            self._store.save(self._game.score.high_score)
