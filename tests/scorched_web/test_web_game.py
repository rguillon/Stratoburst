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


def test_set_paused_delegates_and_flushes_only_the_header_paused() -> None:
    web, game, sink = make()
    web.set_paused(True)
    game.set_paused.assert_called_once_with(True)
    sink.flush.assert_called_once_with(bulk=False)


def test_set_paused_false_delegates_too_resume() -> None:
    web, game, sink = make()
    web.set_paused(False)
    game.set_paused.assert_called_once_with(False)
    sink.flush.assert_called_once_with(bulk=False)


def test_restart_restarts_the_game_and_flushes_every_channel() -> None:
    web, game, sink = make()
    web.restart()
    game.restart.assert_called_once_with()
    sink.flush.assert_called_once_with(bulk=True)
