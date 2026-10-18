import sys
import types

import pytest

from scorched_web.bridge.high_score_store import KEY, HighScoreStore, browser_storage


class FakeStorage:
    """Mirrors the localStorage surface the store uses."""

    def __init__(self, items: dict[str, object] | None = None) -> None:
        self.items: dict[str, object] = dict(items or {})
        self.writes: list[tuple[str, str]] = []

    def getItem(self, key: str) -> object:  # noqa: N802 - the JS name
        return self.items.get(key)

    def setItem(self, key: str, value: str) -> None:  # noqa: N802 - the JS name
        self.writes.append((key, value))
        self.items[key] = value


def store_over(storage: FakeStorage, *, enabled: bool = True) -> HighScoreStore:
    return HighScoreStore(lambda: storage, enabled=enabled)


def test_the_key_is_versioned() -> None:
    assert KEY == "scorched:best:1"


def test_load_returns_the_stored_integer() -> None:
    assert store_over(FakeStorage({KEY: "4200"})).load() == 4200


def test_load_is_zero_when_nothing_is_stored() -> None:
    assert store_over(FakeStorage()).load() == 0


def test_save_writes_the_digit_string_under_the_one_key_and_reports_it() -> None:
    storage = FakeStorage()
    assert store_over(storage).save(5000) is True
    assert storage.writes == [(KEY, "5000")]


def test_a_worse_or_equal_score_afterwards_writes_nothing() -> None:
    storage = FakeStorage()
    store = store_over(storage)
    assert store.save(5000) is True
    assert store.save(4000) is False
    assert store.save(5000) is False
    assert storage.writes == [(KEY, "5000")]


def test_a_score_not_beating_the_loaded_best_writes_nothing() -> None:
    storage = FakeStorage({KEY: "9000"})
    store = store_over(storage)
    assert store.load() == 9000
    assert store.save(8000) is False
    assert store.save(9500) is True
    assert storage.writes == [(KEY, "9500")]


def test_browser_storage_returns_the_local_storage_of_the_js_module(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_js = types.ModuleType("js")
    fake_js.localStorage = FakeStorage()  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "js", fake_js)
    assert browser_storage() is fake_js.localStorage  # type: ignore[attr-defined]


def test_without_a_js_module_the_store_loads_zero_and_saves_nothing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setitem(sys.modules, "js", None)  # makes ``import js`` raise ImportError
    with pytest.raises(ImportError):
        browser_storage()
    store = HighScoreStore(browser_storage, enabled=True)
    assert store.load() == 0
    assert store.save(100) is False
