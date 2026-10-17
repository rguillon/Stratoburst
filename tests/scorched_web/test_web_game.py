from unittest.mock import MagicMock

from scorched_web.web_game import WebGame


def make() -> tuple[WebGame, MagicMock, MagicMock]:
    game, sink = MagicMock(), MagicMock()
    return WebGame(game, sink), game, sink


def test_manifest_delegates() -> None:
    web, game, _ = make()
    assert web.manifest() is game.manifest.return_value


def test_attach_delegates() -> None:
    web, _, sink = make()
    target = object()
    web.attach("header", target)
    sink.attach.assert_called_once_with("header", target)


def test_tick_flushes_bulk_when_steps_ran() -> None:
    web, game, sink = make()
    game.tick.return_value = 2
    assert web.tick(16.7, 0, 1.0, 0.0, 0.0, 0.0) == 2
    game.tick.assert_called_once_with(16.7, 0, 1.0, 0.0, 0.0, 0.0)
    sink.flush.assert_called_once_with(bulk=True)


def test_tick_skips_bulk_when_no_steps() -> None:
    web, game, sink = make()
    game.tick.return_value = 0
    assert web.tick(1.0, 0, 0.0, 0.0, 0.0, 0.0) == 0
    sink.flush.assert_called_once_with(bulk=False)
