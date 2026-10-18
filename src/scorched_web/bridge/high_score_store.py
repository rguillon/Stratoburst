"""The single best score kept in the browser (D-22).

Storage is optional and untrusted: a missing ``js`` module, a throwing ``localStorage`` or a
throwing ``getItem`` / ``setItem`` never breaks the game, it only means nothing is remembered.
"""

from collections.abc import Callable
from typing import Any, Final

from scorched_core.tuning import SCORE_CAP

KEY: Final = "scorched:best:1"
_MAX_DIGITS: Final = 8


def browser_storage() -> Any:  # noqa: ANN401 - a JsProxy
    """Return ``js.localStorage``; raises natively, where there is no ``js`` module."""
    import js  # noqa: PLC0415 - only exists inside Pyodide, so it is resolved lazily

    return js.localStorage


def _parse(raw: object) -> int:
    """A stored value is trusted only as 1 to 8 ASCII digits, clamped to the score cap.

    Anything else (another type, signs, spaces, exponents, other scripts' digits, too long) is
    junk and reads as 0: nothing is evaluated and nothing but a digit string is ever accepted.
    """
    if isinstance(raw, str) and raw.isascii() and raw.isdigit() and len(raw) <= _MAX_DIGITS:
        return min(int(raw), SCORE_CAP)
    return 0


class HighScoreStore:
    """Reads and writes the best score through an injected storage getter."""

    __slots__ = ("_best", "_enabled", "_get_storage")

    def __init__(self, get_storage: Callable[[], Any], *, enabled: bool) -> None:
        """``enabled=False`` makes the store read-only: a test-flag run never saves (IN-05)."""
        self._get_storage = get_storage
        self._enabled = enabled
        self._best = 0

    def load(self) -> int:
        """Return the stored best score; anything missing, broken or unparsable reads as 0."""
        try:
            raw = self._get_storage().getItem(KEY)
        # Storage is optional: JsException, AttributeError, ImportError, ValueError all expected.
        except Exception:
            return 0
        self._best = _parse(raw)
        return self._best

    def save(self, score: int) -> bool:
        """Store ``score`` if it beats the best known; return whether it was written."""
        value = min(max(int(score), 0), SCORE_CAP)
        if not self._enabled or value <= self._best:
            return False
        try:
            self._get_storage().setItem(KEY, str(value))
        # Storage is optional: JsException (quota, SecurityError) and ImportError are expected.
        except Exception:
            return False
        self._best = value
        return True
