"""Deliberate faults the ``?crash=`` URL flag can inject, to prove the error panel (PLAT-09)."""

from enum import StrEnum
from typing import Final

# The simulation tick on which an injected Python fault fires.
FAULT_TICK: Final = 120


class FaultMode(StrEnum):
    """Which fault to inject. ``JS`` is acted on by the JS side only."""

    NONE = "none"
    PY = "py"
    JS = "js"
