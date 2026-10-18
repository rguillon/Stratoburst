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


def make_stored(
    *, paused: bool = False, save_requested: bool = False, high_score: int = 1234
) -> tuple[WebGame, MagicMock, MagicMock]:
    game, store = MagicMock(), MagicMock()
    game.paused = paused
    game.save_requested = save_requested
    game.score.high_score = high_score
    game.tick.return_value = 1
    return WebGame(game, MagicMock(), store), game, store


def tick(web: WebGame) -> None:
    web.tick(16.7, 0, 0.0, 0.0, 0.0, 0.0)


def test_an_ordinary_tick_never_stores_anything() -> None:
    web, _, store = make_stored()
    for _ in range(3):
        tick(web)
    store.save.assert_not_called()


def test_a_tick_with_a_save_request_stores_the_high_score_once_and_clears_the_request() -> None:
    web, game, store = make_stored(save_requested=True, high_score=7777)
    tick(web)
    store.save.assert_called_once_with(7777)
    game.clear_save_request.assert_called_once_with()


def test_a_tick_across_which_the_game_pauses_stores_the_high_score() -> None:
    web, game, store = make_stored(paused=False, high_score=4321)

    def pause_during_tick(*_args: float) -> int:
        game.paused = True
        return 1

    game.tick.side_effect = pause_during_tick
    tick(web)
    store.save.assert_called_once_with(4321)
    game.clear_save_request.assert_not_called()


def test_a_tick_while_already_paused_stores_nothing() -> None:
    web, _, store = make_stored(paused=True)
    tick(web)
    store.save.assert_not_called()


def test_pausing_stores_the_high_score() -> None:
    web, game, store = make_stored(high_score=555)
    web.set_paused(True)
    store.save.assert_called_once_with(555)
    game.set_paused.assert_called_once_with(True)


def test_resuming_stores_nothing() -> None:
    web, _, store = make_stored()
    web.set_paused(False)
    store.save.assert_not_called()


def test_without_a_store_pausing_and_save_requests_are_harmless() -> None:
    game = MagicMock()
    game.paused = False
    game.save_requested = True
    game.tick.return_value = 1
    web = WebGame(game, MagicMock())
    web.tick(16.7, 0, 0.0, 0.0, 0.0, 0.0)
    web.set_paused(True)
    game.clear_save_request.assert_not_called()
