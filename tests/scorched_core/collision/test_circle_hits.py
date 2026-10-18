import math
from array import array

from scorched_core.collision.circle_hits import circles_touch, resolve_shots_vs_enemies
from scorched_core.collision.uniform_grid import UniformGrid
from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import ENEMY_CAP, EV_HIT
from scorched_core.tuning import (
    ENEMY_FLASH_TICKS,
    ENEMY_HP,
    ENEMY_RADIUS,
    GRID_CELL,
    PBULLET_RADIUS,
)

JET_HP = ENEMY_HP[EnemyKind.JET]
JET_RADIUS = ENEMY_RADIUS[EnemyKind.JET]


def test_overlapping_circles_touch() -> None:
    assert circles_touch(0.0, 0.0, 2.5, 3.0, 0.0, 2.0)


def test_distant_circles_do_not_touch() -> None:
    assert not circles_touch(0.0, 0.0, 2.5, 50.0, 40.0, 2.0)


def test_touch_is_inclusive_at_exactly_the_radius_sum() -> None:
    assert circles_touch(0.0, 0.0, 2.5, 4.5, 0.0, 2.0)


def test_touch_fails_one_float_step_past_the_radius_sum() -> None:
    just_outside = math.nextafter(4.5, math.inf)
    assert not circles_touch(0.0, 0.0, 2.5, just_outside, 0.0, 2.0)


def test_touch_is_symmetric_on_the_diagonal() -> None:
    assert circles_touch(0.0, 0.0, 3.0, 3.0, 4.0, 2.0)
    assert circles_touch(3.0, 4.0, 2.0, 0.0, 0.0, 3.0)


# --- player bolts versus enemies ----------------------------------------------------------


def _world(
    enemies: list[tuple[float, float]],
    bolts: list[tuple[float, float]],
    hp: int = JET_HP,
    kind: EnemyKind = EnemyKind.JET,
) -> tuple[BulletPool, EnemyPool, UniformGrid, array]:
    pool_e = EnemyPool()
    for x, y in enemies:
        pool_e.spawn(kind, x, y, 0.0, 0.0)
        pool_e.hp[pool_e.n - 1] = hp
    pool = BulletPool(128)
    for x, y in bolts:
        pool.spawn(x, y, 0.0, -8.0)
    grid = UniformGrid(240.0, 320.0, GRID_CELL, ENEMY_CAP)
    grid.rebuild(pool_e.x, pool_e.y, pool_e.n)
    return pool, pool_e, grid, array("i", bytes(4 * ENEMY_CAP))


def _resolve(
    pool: BulletPool, enemies: EnemyPool, grid: UniformGrid, scratch: array, damage: int = 1
) -> int:
    return resolve_shots_vs_enemies(pool, enemies, grid, scratch, damage, EventRing())


def test_a_bolt_on_an_enemy_hits_it_and_is_consumed() -> None:
    pool, enemies, grid, scratch = _world([(100.0, 100.0)], [(100.0, 104.0)])
    assert _resolve(pool, enemies, grid, scratch) == 1
    assert pool.n == 0
    assert enemies.hp[0] == JET_HP - 1
    assert enemies.flash[0] == ENEMY_FLASH_TICKS


def test_the_damage_argument_is_applied() -> None:
    pool, enemies, grid, scratch = _world([(100.0, 100.0)], [(100.0, 104.0)])
    _resolve(pool, enemies, grid, scratch, damage=2)
    assert enemies.hp[0] == JET_HP - 2


def test_a_hit_pushes_its_event_into_the_given_ring() -> None:
    pool, enemies, grid, scratch = _world([(100.0, 100.0)], [(100.0, 104.0)])
    ring = EventRing()
    resolve_shots_vs_enemies(pool, enemies, grid, scratch, 1, ring)
    assert (ring.n, ring.buf[0]) == (1, EV_HIT)


def test_a_bolt_touching_nothing_survives() -> None:
    pool, enemies, grid, scratch = _world([(100.0, 100.0)], [(100.0, 140.0)])
    assert _resolve(pool, enemies, grid, scratch) == 0
    assert pool.n == 1
    assert enemies.hp[0] == JET_HP


def test_touching_at_exactly_the_radius_sum_counts_as_a_hit() -> None:
    reach = JET_RADIUS + PBULLET_RADIUS
    pool, enemies, grid, scratch = _world([(100.0, 100.0)], [(100.0 + reach, 100.0)])
    assert _resolve(pool, enemies, grid, scratch) == 1


def test_a_bolt_just_past_the_radius_sum_misses() -> None:
    reach = JET_RADIUS + PBULLET_RADIUS
    pool, enemies, grid, scratch = _world([(100.0, 100.0)], [(100.0 + reach + 0.5, 100.0)])
    assert _resolve(pool, enemies, grid, scratch) == 0


def test_each_enemy_is_hit_at_its_own_radius() -> None:
    reach = ENEMY_RADIUS[EnemyKind.CARRIER] + PBULLET_RADIUS
    pool, enemies, grid, scratch = _world(
        [(100.0, 100.0)], [(100.0 + reach - 0.5, 100.0)], kind=EnemyKind.CARRIER
    )
    assert _resolve(pool, enemies, grid, scratch) == 1  # a jet-sized circle would miss here
    assert reach - 0.5 > JET_RADIUS + PBULLET_RADIUS


def test_a_bolt_over_two_enemies_hits_only_the_first_in_query_order() -> None:
    enemies_at = [(60.0, 60.0), (100.0, 100.0), (100.0, 100.0), (60.0, 60.0), (60.0, 60.0)]
    enemies_at.append((100.0, 100.0))  # index 5
    pool, enemies, grid, scratch = _world(enemies_at, [(100.0, 100.0)])
    assert _resolve(pool, enemies, grid, scratch) == 1
    assert pool.n == 0
    assert [enemies.hp[i] for i in (1, 2, 5)] == [JET_HP - 1, JET_HP, JET_HP]


def test_first_in_query_order_follows_cell_rows_before_enemy_index() -> None:
    # Enemy 0 sits in the cell row below the bolt, enemy 1 in the row above: the row above is
    # visited first, so enemy 1 is hit even though enemy 0 has the lower index.
    pool, enemies, grid, scratch = _world([(100.0, 70.0), (100.0, 60.0)], [(100.0, 66.0)])
    assert _resolve(pool, enemies, grid, scratch) == 1
    assert (enemies.hp[0], enemies.hp[1]) == (JET_HP, JET_HP - 1)


def test_an_enemy_killed_earlier_in_the_pass_absorbs_no_further_bolt() -> None:
    pool, enemies, grid, scratch = _world([(100.0, 100.0)], [(100.0, 100.0), (101.0, 100.0)], hp=1)
    assert _resolve(pool, enemies, grid, scratch) == 1
    assert pool.n == 1  # exactly one bolt was consumed; the other flew on
    assert enemies.n == 1  # the dead enemy is removed by the caller, not by the hit pass
    assert enemies.hp[0] <= 0


def test_a_second_bolt_moves_on_to_the_next_enemy_when_the_first_is_dead() -> None:
    pool, enemies, grid, scratch = _world(
        [(100.0, 100.0), (104.0, 100.0)], [(100.0, 100.0), (102.0, 100.0)], hp=1
    )
    assert _resolve(pool, enemies, grid, scratch) == 2
    assert pool.n == 0
    assert (enemies.hp[0], enemies.hp[1]) == (0, 0)


def test_a_bolt_in_a_far_cell_never_reaches_an_enemy_outside_its_block() -> None:
    pool, enemies, grid, scratch = _world([(20.0, 20.0)], [(200.0, 300.0)])
    assert _resolve(pool, enemies, grid, scratch) == 0
    assert pool.n == 1


def test_no_enemies_or_no_bolts_resolve_to_zero() -> None:
    pool, enemies, grid, scratch = _world([], [(100.0, 100.0)])
    assert _resolve(pool, enemies, grid, scratch) == 0
    assert pool.n == 1
    pool, enemies, grid, scratch = _world([(100.0, 100.0)], [])
    assert _resolve(pool, enemies, grid, scratch) == 0


def test_surviving_bolts_keep_their_velocity_after_swap_removals() -> None:
    pool, enemies, grid, scratch = _world([(100.0, 100.0)], [(100.0, 100.0), (10.0, 10.0)])
    _resolve(pool, enemies, grid, scratch)
    assert pool.n == 1
    assert (pool.x[0], pool.y[0], pool.vy[0]) == (10.0, 10.0, -8.0)
