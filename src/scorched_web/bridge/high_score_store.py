"""The single best score kept in the browser (D-22). Skeleton for the RED commit."""

from collections.abc import Callable
from typing import Any, Final

KEY: Final = "scorched:best:1"


def browser_storage() -> Any:  # noqa: ANN401 - a JsProxy
    """Return ``js.localStorage``."""
    raise NotImplementedError


class HighScoreStore:
    """Reads and writes the best score through an injected storage getter."""

    __slots__ = ("_best", "_enabled", "_get_storage")

    def __init__(self, get_storage: Callable[[], Any], *, enabled: bool) -> None:
        self._get_storage = get_storage
        self._enabled = enabled
        self._best = 0

    def load(self) -> int:
        """Return the stored best score, or 0."""
        raise NotImplementedError

    def save(self, score: int) -> bool:
        """Store ``score`` if it beats the stored best; return whether it was written."""
        raise NotImplementedError
