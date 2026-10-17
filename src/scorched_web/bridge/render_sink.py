"""Copies Python channel buffers into JS-owned typed arrays."""

from array import array
from collections.abc import Mapping
from typing import Any


class RenderSink:
    """Validates and fills JS typed arrays (anything with ``length`` and ``assign``)."""

    __slots__ = ("_buffers", "_targets")

    def __init__(self, buffers: Mapping[str, array]) -> None:
        self._buffers = buffers
        self._targets: dict[str, Any] = {}

    def attach(self, name: str, target: Any) -> None:  # noqa: ANN401 - duck-typed JsProxy
        """Bind ``target`` to channel ``name``; reject unknown names and length drift."""
        buffer = self._buffers.get(name)
        if buffer is None:
            msg = f"unknown channel {name!r}"
            raise ValueError(msg)
        if int(target.length) != len(buffer):
            msg = f"channel {name!r}: JS length {int(target.length)} != Python length {len(buffer)}"
            raise ValueError(msg)
        self._targets[name] = target

    def flush(self, *, bulk: bool) -> None:
        """Assign the header always, and every other attached channel only when ``bulk``."""
        for name, target in self._targets.items():
            if name == "header" or bulk:
                target.assign(self._buffers[name])
