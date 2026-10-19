"""The bullet-pattern registry (ENMY-04, ROADMAP criterion 5): a new pattern is a new entry here.

``PATTERNS`` maps a name to its frozen ``PatternSpec``. The enemy pool and the stage director
never hold names in the step loop: names resolve once, at import, to an index into
``PATTERN_TABLE`` (one fixed order, the registry's insertion order).
"""

from typing import Final

from scorched_core.patterns.fire_pattern import FirePattern
from scorched_core.patterns.pattern_spec import PatternSpec

PATTERNS: Final[dict[str, PatternSpec]] = {
    # The per-kind defaults: these reproduce the Phase 2 gallery exactly.
    "jet_aimed": PatternSpec(FirePattern.AIMED, speed=2.0, interval=140),
    "heli_ring": PatternSpec(
        FirePattern.RING, count=8, speed=1.3, interval=150, phase_step_deg=22.5
    ),
    "tank_aimed": PatternSpec(FirePattern.AIMED, speed=1.6, interval=120),
    "turret_aimed": PatternSpec(FirePattern.AIMED, speed=1.8, interval=90),
    # Stage patterns (D-07, Raiden pacing): slow bullets, long intervals.
    "aimed_slow": PatternSpec(FirePattern.AIMED, speed=1.3, interval=150),
    "spread3": PatternSpec(FirePattern.SPREAD, count=3, speed=1.5, interval=150, arc_deg=40.0),
    "spread5": PatternSpec(FirePattern.SPREAD, count=5, speed=1.4, interval=180, arc_deg=70.0),
    "ring10_slow": PatternSpec(
        FirePattern.RING, count=10, speed=1.0, interval=200, phase_step_deg=18.0
    ),
    "stream3": PatternSpec(FirePattern.STREAM, speed=1.7, interval=170, burst=3, burst_gap=8),
    # The mid-boss armored train (plan 03-14): slow, sparse, Raiden pacing.
    "train_turret_aimed": PatternSpec(FirePattern.AIMED, speed=1.5, interval=120),
    "train_hull_spread": PatternSpec(
        FirePattern.SPREAD, count=5, speed=1.3, interval=170, arc_deg=60.0
    ),
    # The stage 1 giant bomber (plan 03-19), phase 1: wing turrets and a nose ring. Every bomber
    # pattern stays at 2.0 units per step or less and 45 steps or more between volleys.
    "bomber_turret_spread": PatternSpec(
        FirePattern.SPREAD, count=3, speed=1.5, interval=100, arc_deg=24.0
    ),
    "bomber_nose_ring": PatternSpec(
        FirePattern.RING, count=10, speed=1.2, interval=160, phase_step_deg=18.0
    ),
    # Phase 2: the core opens with a slowly rotating ring and a short stream.
    "bomber_core_ring": PatternSpec(
        FirePattern.RING, count=12, speed=1.4, interval=80, phase_step_deg=7.5
    ),
    "bomber_core_stream": PatternSpec(
        FirePattern.STREAM, speed=1.8, interval=120, burst=3, burst_gap=8
    ),
    # Phase 3, desperation: faster and denser, still nowhere near bullet hell.
    "bomber_desperation_ring": PatternSpec(
        FirePattern.RING, count=16, speed=1.6, interval=50, phase_step_deg=11.25
    ),
    "bomber_desperation_spread": PatternSpec(
        FirePattern.SPREAD, count=5, speed=1.6, interval=70, arc_deg=50.0
    ),
}
PATTERN_NAMES: Final = tuple(PATTERNS)
PATTERN_TABLE: Final = tuple(PATTERNS.values())
_INDEX: Final = {name: position for position, name in enumerate(PATTERN_NAMES)}


def pattern_index(name: str) -> int:
    """Return the ``PATTERN_TABLE`` index of the pattern called ``name``; ValueError if unknown."""
    try:
        return _INDEX[name]
    except KeyError:
        msg = f"unknown bullet pattern {name!r}"
        raise ValueError(msg) from None
