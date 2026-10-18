import pytest

from scorched_core.collision.area_hits import resolve_beam_vs_enemies
from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import EV_HIT

JET_RADIUS = 9.0
BEAM_X = 100.0
HALF_W = 4.0
TOP = 0.0
BOTTOM = 200.0


def _pool(*positions: tuple[float, float], kind: EnemyKind = EnemyKind.JET) -> EnemyPool:
    pool = EnemyPool()
    for x, y in positions:
        pool.spawn(kind, x, y, MotionKind.DIVE, 0.0, 0.0)
    return pool


def _beam(pool: EnemyPool, damage: int = 2, events: EventRing | None = None) -> int:
    return resolve_beam_vs_enemies(pool, BEAM_X, HALF_W, TOP, BOTTOM, damage, events or EventRing())


def test_an_enemy_in_the_column_takes_the_damage_and_flashes() -> None:
    pool = _pool((BEAM_X, 100.0))
    hp = pool.hp[0]
    assert _beam(pool, damage=3) == 1
    assert pool.hp[0] == hp - 3
    assert pool.flash[0] > 0


def test_the_beam_pierces_every_enemy_stacked_in_the_column() -> None:
    pool = _pool((BEAM_X, 40.0), (BEAM_X + 2.0, 100.0), (BEAM_X - 3.0, 160.0))
    before = list(pool.hp[:3])
    assert _beam(pool, damage=1) == 3
    assert [pool.hp[i] for i in range(3)] == [hp - 1 for hp in before]


def test_a_tank_in_the_column_takes_damage_too() -> None:
    pool = _pool((BEAM_X, 120.0), kind=EnemyKind.TANK)
    hp = pool.hp[0]
    assert _beam(pool) == 1
    assert pool.hp[0] == hp - 2


def test_an_enemy_below_the_nose_is_not_hit() -> None:
    pool = _pool((BEAM_X, BOTTOM + JET_RADIUS + 1.0))
    assert _beam(pool) == 0
    assert pool.flash[0] == 0


def test_an_enemy_whose_circle_reaches_up_to_the_nose_is_hit() -> None:
    pool = _pool((BEAM_X, BOTTOM + JET_RADIUS))  # the circle touches the nose exactly
    assert _beam(pool) == 1


def test_an_enemy_beside_the_beam_by_more_than_its_radius_is_not_hit() -> None:
    pool = _pool(
        (BEAM_X + HALF_W + JET_RADIUS + 0.5, 100.0), (BEAM_X - HALF_W - JET_RADIUS - 0.5, 100.0)
    )
    assert _beam(pool) == 0


def test_edge_contact_counts_on_either_side() -> None:
    pool = _pool((BEAM_X + HALF_W + JET_RADIUS, 100.0), (BEAM_X - HALF_W - JET_RADIUS, 100.0))
    assert _beam(pool) == 2


def test_an_enemy_above_the_top_edge_is_hit_only_while_its_circle_reaches_in() -> None:
    pool = _pool((BEAM_X, TOP - JET_RADIUS), (BEAM_X, TOP - JET_RADIUS - 1.0))
    assert _beam(pool) == 1
    assert pool.flash[0] > 0
    assert pool.flash[1] == 0


def test_the_corner_of_the_rectangle_uses_the_true_distance() -> None:
    # Diagonal from the bottom-right corner: dx = dy = 6 gives 6 * sqrt(2) ~ 8.49 <= 9, dx = dy = 7
    # gives ~ 9.9 > 9.
    inside = _pool((BEAM_X + HALF_W + 6.0, BOTTOM + 6.0))
    outside = _pool((BEAM_X + HALF_W + 7.0, BOTTOM + 7.0))
    assert _beam(inside) == 1
    assert _beam(outside) == 0


def test_a_dead_enemy_is_not_hit_again() -> None:
    pool = _pool((BEAM_X, 100.0))
    pool.hp[0] = 0
    assert _beam(pool) == 0


def test_hit_events_are_merged_by_the_flash_state() -> None:
    pool = _pool((BEAM_X, 100.0))
    pool.hp[0] = 50
    events = EventRing()
    assert _beam(pool, damage=1, events=events) == 1
    assert _beam(pool, damage=1, events=events) == 1  # still flashing: no second spark burst
    assert events.n == 1
    assert events.buf[0] == EV_HIT


def test_an_empty_pool_hits_nothing() -> None:
    assert _beam(EnemyPool()) == 0


@pytest.mark.parametrize("half_w", [0.0, 7.0])
def test_a_zero_width_beam_is_still_a_line(half_w: float) -> None:
    pool = _pool((BEAM_X + 5.0, 100.0))
    assert resolve_beam_vs_enemies(pool, BEAM_X, half_w, TOP, BOTTOM, 1, EventRing()) == 1
