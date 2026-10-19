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


@pytest.mark.parametrize(
    "stored",
    [
        "abc",
        "-5",
        "1e9",
        "",
        "12345678901",
        "123456789",
        " 42",
        "42 ",
        "4 2",
        "+7",
        "4.2",
        "²",
        "٣",
    ],
)
def test_junk_in_storage_loads_as_zero(stored: str) -> None:
    assert store_over(FakeStorage({KEY: stored})).load() == 0


@pytest.mark.parametrize("stored", [42, 4.5, object(), ["7"], True])
def test_a_poisoned_non_string_value_loads_as_zero(stored: object) -> None:
    assert store_over(FakeStorage({KEY: stored})).load() == 0


@pytest.mark.parametrize(
    ("stored", "expected"),
    [("0", 0), ("7", 7), ("00000042", 42), ("99999999", 9_999_999), ("9999999", 9_999_999)],
)
def test_one_to_eight_ascii_digits_load_clamped_to_the_score_cap(
    stored: str, expected: int
) -> None:
    assert store_over(FakeStorage({KEY: stored})).load() == expected


def test_a_junk_stored_value_is_replaced_by_the_first_real_best() -> None:
    storage = FakeStorage({KEY: "junk"})
    store = store_over(storage)
    assert store.load() == 0
    assert store.save(300) is True
    assert storage.items[KEY] == "300"


def test_save_clamps_to_the_score_cap_and_ignores_negative_scores() -> None:
    storage = FakeStorage()
    store = store_over(storage)
    assert store.save(-5) is False
    assert store.save(10**9) is True
    assert storage.writes == [(KEY, "9999999")]


class RaisingStorage:
    """Raises from whichever access is switched on, like a blocked or full localStorage."""

    def __init__(self, *, on_get: bool = False, on_set: bool = False) -> None:
        self.on_get = on_get
        self.on_set = on_set

    def getItem(self, key: str) -> object:  # noqa: N802 - the JS name
        if self.on_get:
            msg = f"SecurityError reading {key}"
            raise RuntimeError(msg)
        return "100"

    def setItem(self, key: str, value: str) -> None:  # noqa: N802 - the JS name
        if self.on_set:
            msg = f"QuotaExceededError writing {key}={value}"
            raise RuntimeError(msg)


def test_a_getter_that_raises_leaves_load_at_zero_and_save_false() -> None:
    def blocked() -> object:
        msg = "localStorage is disabled"
        raise RuntimeError(msg)

    store = HighScoreStore(blocked, enabled=True)
    assert store.load() == 0
    assert store.save(50) is False


def test_a_get_item_that_raises_leaves_load_at_zero() -> None:
    assert HighScoreStore(lambda: RaisingStorage(on_get=True), enabled=True).load() == 0


def test_a_set_item_that_raises_a_quota_error_leaves_save_false_and_a_later_retry_possible() -> (
    None
):
    storage = RaisingStorage(on_set=True)
    store = HighScoreStore(lambda: storage, enabled=True)
    assert store.load() == 100
    assert store.save(500) is False
    storage.on_set = False
    assert store.save(500) is True


def test_a_read_only_store_never_writes_but_still_reads() -> None:
    storage = FakeStorage({KEY: "4200"})
    store = store_over(storage, enabled=False)
    assert store.load() == 4200
    assert store.save(99999) is False
    assert storage.writes == []
