"""Formation helpers: a formation is data, a function that expands into plain WaveEntry rows.

Each helper forwards extra ``WaveEntry`` fields (``motion``, ``path``, ``pattern``, ``drop``,
``y``, ``vx``, ``vy``) to every member, so a stage module can write a whole formation in one
line and ``StageData`` still sees nothing but ordinary rows (ENMY-01).
"""

import dataclasses

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.protocol import PLAYFIELD_W
from scorched_core.stages.wave_entry import WaveEntry


def _require_members(count: int) -> None:
    if count < 1:
        msg = f"a formation needs at least one member, got {count}"
        raise ValueError(msg)


def v_formation(  # noqa: PLR0913, PLR0917 - a V is a spawn plus its count, spacing and stagger
    at: float,
    kind: EnemyKind,
    x: float,
    count: int,
    spacing_x: float,
    spacing_at: float,
    **fields: object,
) -> tuple[WaveEntry, ...]:
    """Return a V of ``count`` rows: a leader on ``x`` and wings fanning out behind it.

    Each rank is ``spacing_at`` later than the one before and ``spacing_x`` wider on each side,
    left wing first. An even count leaves the last rank with only its left wing. The rows come
    out ordered by ``at``.
    """
    _require_members(count)
    rows = []
    for member in range(count):
        rank = (member + 1) // 2
        side = 0 if member == 0 else (-1 if member % 2 else 1)
        rows.append(
            WaveEntry(at + rank * spacing_at, kind, x + side * rank * spacing_x, **fields)  # type: ignore[arg-type]
        )
    return tuple(rows)


def line_formation(
    at: float,
    kind: EnemyKind,
    x: float,
    count: int,
    spacing_x: float,
    **fields: object,
) -> tuple[WaveEntry, ...]:
    """Return ``count`` rows abreast at one ``at``, ``spacing_x`` apart and centred on ``x``."""
    _require_members(count)
    first = x - (count - 1) * spacing_x / 2.0
    return tuple(
        WaveEntry(at, kind, first + member * spacing_x, **fields)  # type: ignore[arg-type]
        for member in range(count)
    )


def column_formation(
    at: float,
    kind: EnemyKind,
    x: float,
    count: int,
    gap_at: float,
    **fields: object,
) -> tuple[WaveEntry, ...]:
    """Return ``count`` copies of one entry ``gap_at`` apart: follow the leader down one path."""
    _require_members(count)
    return tuple(
        WaveEntry(at + member * gap_at, kind, x, **fields)  # type: ignore[arg-type]
        for member in range(count)
    )


def mirrored(entries: tuple[WaveEntry, ...]) -> tuple[WaveEntry, ...]:
    """Return ``entries`` followed by their reflections about the centre line of the field.

    A reflection flips x, negates the sideways velocity and toggles ``mirror``, so a path walks
    the other way. Authoring order is kept: the originals first, then the copies.
    """
    copies = tuple(
        dataclasses.replace(
            entry, x=PLAYFIELD_W - entry.x, vx=0.0 - entry.vx, mirror=not entry.mirror
        )
        for entry in entries
    )
    return entries + copies
