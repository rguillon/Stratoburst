import pytest

from scorched_core.collision.area_hits import (
    clear_bullets_in_radius,
    resolve_beam_vs_enemies,
    resolve_bomb_vs_enemies,
)
from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.bullet_pool import BulletPool
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


BLAST_X = 100.0
BLAST_Y = 100.0
BLAST_R = 40.0


def _bomb(pool: EnemyPool, damage: int = 4, events: EventRing | None = None) -> int:
    return resolve_bomb_vs_enemies(pool, BLAST_X, BLAST_Y, BLAST_R, damage, events or EventRing())


def test_the_blast_damages_every_enemy_inside_its_radius() -> None:
    pool = _pool((BLAST_X, BLAST_Y), (BLAST_X + 20.0, BLAST_Y - 10.0), (BLAST_X - 30.0, BLAST_Y))
    before = list(pool.hp[:3])
    assert _bomb(pool, damage=4) == 3
    assert [pool.hp[i] for i in range(3)] == [hp - 4 for hp in before]
    assert pool.flash[0] > 0


def test_the_blast_burns_ground_units_too() -> None:
    pool = _pool((BLAST_X + 10.0, BLAST_Y), kind=EnemyKind.TANK)
    hp = pool.hp[0]
    assert _bomb(pool) == 1
    assert pool.hp[0] == hp - 4


def test_an_enemy_whose_circle_just_touches_the_blast_is_hit() -> None:
    pool = _pool((BLAST_X + BLAST_R + JET_RADIUS, BLAST_Y))  # edge contact on the right
    assert _bomb(pool) == 1


def test_an_enemy_just_beyond_the_blast_is_not_hit() -> None:
    pool = _pool((BLAST_X + BLAST_R + JET_RADIUS + 0.5, BLAST_Y), (BLAST_X, BLAST_Y - 60.0))
    assert _bomb(pool) == 0
    assert pool.flash[0] == 0
    assert pool.flash[1] == 0


def test_the_blast_uses_the_true_distance_on_the_diagonal() -> None:
    # Reach is 49; (34, 34) is 48.08 away, (35, 35) is 49.5.
    inside = _pool((BLAST_X + 34.0, BLAST_Y + 34.0))
    outside = _pool((BLAST_X + 35.0, BLAST_Y + 35.0))
    assert _bomb(inside) == 1
    assert _bomb(outside) == 0


def test_the_blast_skips_a_dead_enemy() -> None:
    pool = _pool((BLAST_X, BLAST_Y))
    pool.hp[0] = 0
    assert _bomb(pool) == 0


def test_the_blast_merges_hit_events_by_the_flash_state() -> None:
    pool = _pool((BLAST_X, BLAST_Y))
    pool.hp[0] = 50
    events = EventRing()
    assert _bomb(pool, damage=1, events=events) == 1
    assert _bomb(pool, damage=1, events=events) == 1
    assert events.n == 1
    assert events.buf[0] == EV_HIT


def test_the_blast_over_an_empty_pool_hits_nothing() -> None:
    assert _bomb(EnemyPool()) == 0


def _bullets(*positions: tuple[float, float]) -> BulletPool:
    pool = BulletPool(16)
    for x, y in positions:
        assert pool.spawn(x, y, 0.0, 0.0)
    return pool


def test_clearing_removes_exactly_the_bullets_inside_the_circle() -> None:
    pool = _bullets((100.0, 100.0), (130.0, 100.0), (100.0, 200.0), (95.0, 105.0), (300.0, 300.0))
    assert clear_bullets_in_radius(pool, BLAST_X, BLAST_Y, BLAST_R) == 3
    survivors = sorted((pool.x[i], pool.y[i]) for i in range(pool.n))
    assert survivors == [(100.0, 200.0), (300.0, 300.0)]


def test_a_bullet_exactly_on_the_circle_is_cleared() -> None:
    pool = _bullets((BLAST_X + BLAST_R, BLAST_Y), (BLAST_X, BLAST_Y - BLAST_R))
    assert clear_bullets_in_radius(pool, BLAST_X, BLAST_Y, BLAST_R) == 2
    assert pool.n == 0


def test_a_bullet_a_hair_outside_the_circle_stays() -> None:
    pool = _bullets((BLAST_X + BLAST_R + 0.25, BLAST_Y))
    assert clear_bullets_in_radius(pool, BLAST_X, BLAST_Y, BLAST_R) == 0
    assert pool.n == 1


def test_clearing_an_empty_pool_clears_nothing() -> None:
    assert clear_bullets_in_radius(BulletPool(4), BLAST_X, BLAST_Y, BLAST_R) == 0
