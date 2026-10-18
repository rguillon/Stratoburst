import math

from scorched_core.collision.ship_hits import (
    resolve_bodies_vs_ship,
    resolve_bullets_vs_ship,
    resolve_pickups_vs_ship,
)
from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.pools.pickup_pool import PickupPool
from scorched_core.tuning import (
    ENEMY_BULLET_RADIUS,
    ENEMY_RADIUS,
    HITBOX_RADIUS,
    PICKUP_GRAB_RADIUS,
    PICKUP_RADIUS,
)

REACH = PICKUP_GRAB_RADIUS + PICKUP_RADIUS


class Collector:
    """Records every pickup handed to the collect callback."""

    def __init__(self) -> None:
        self.caught: list[tuple[int, int, float, float]] = []

    def __call__(self, kind: int, color: int, x: float, y: float) -> None:
        self.caught.append((kind, color, x, y))


def _pool(*positions: tuple[float, float], kind: PickupKind = PickupKind.CRYSTAL) -> PickupPool:
    pool = PickupPool()
    for x, y in positions:
        pool.spawn(kind, x, y, 0.0, 0.0)
    return pool


def test_a_pickup_on_the_ship_is_collected_once_and_removed() -> None:
    pool, collector = _pool((100.0, 200.0)), Collector()
    assert resolve_pickups_vs_ship(pool, 100.0, 200.0, collector) == 1
    assert collector.caught == [(PickupKind.CRYSTAL, 0, 100.0, 200.0)]
    assert pool.n == 0
    assert resolve_pickups_vs_ship(pool, 100.0, 200.0, collector) == 0
    assert len(collector.caught) == 1


def test_edge_contact_with_the_grab_circle_counts() -> None:
    pool, collector = _pool((100.0 + REACH, 200.0)), Collector()
    assert resolve_pickups_vs_ship(pool, 100.0, 200.0, collector) == 1


def test_a_hair_past_the_grab_circle_is_a_miss() -> None:
    # The columns are float32, so step by an amount a float32 can represent at this magnitude.
    pool, collector = _pool((100.0 + REACH + 0.01, 200.0)), Collector()
    assert resolve_pickups_vs_ship(pool, 100.0, 200.0, collector) == 0
    assert pool.n == 1
    assert collector.caught == []


def test_the_ship_body_catches_what_the_two_unit_hitbox_core_would_miss() -> None:
    # 12 units away: outside the 2-unit core plus the pickup, inside the 10-unit grab circle.
    pool, collector = _pool((112.0, 200.0)), Collector()
    assert resolve_pickups_vs_ship(pool, 100.0, 200.0, collector) == 1


def test_two_pickups_touched_in_one_step_are_both_collected_highest_slot_first() -> None:
    pool = PickupPool()
    pool.spawn(PickupKind.RED, 98.0, 200.0, 0.0, 0.0)
    pool.spawn(PickupKind.BLUE, 102.0, 200.0, 0.0, 0.0)
    collector = Collector()
    assert resolve_pickups_vs_ship(pool, 100.0, 200.0, collector) == 2
    assert [kind for kind, *_ in collector.caught] == [PickupKind.BLUE, PickupKind.RED]
    assert pool.n == 0


def test_only_the_touching_pickup_is_taken_and_the_other_keeps_its_slot() -> None:
    pool = PickupPool()
    pool.spawn(PickupKind.RED, 100.0, 200.0, 0.0, 0.0)  # caught, slot 0
    pool.spawn(PickupKind.BLUE, 10.0, 10.0, 0.0, 0.0)  # far away, last slot
    collector = Collector()
    assert resolve_pickups_vs_ship(pool, 100.0, 200.0, collector) == 1
    assert pool.n == 1
    assert (pool.kind[0], pool.x[0]) == (PickupKind.BLUE, 10.0)


def test_the_colour_passed_to_collect_is_the_colour_at_the_instant_of_the_catch() -> None:
    pool, collector = _pool((100.0, 200.0)), Collector()
    pool.age[0] = 95  # second third of the cycle: blue
    resolve_pickups_vs_ship(pool, 100.0, 200.0, collector)
    assert collector.caught[0][1] == 1


# --- enemy bullets versus the hitbox core -------------------------------------------------

BULLET_REACH = ENEMY_BULLET_RADIUS + HITBOX_RADIUS


def _bullets(*positions: tuple[float, float]) -> BulletPool:
    pool = BulletPool(32)
    for x, y in positions:
        pool.spawn(x, y, 0.0, 2.0)
    return pool


def test_a_bullet_on_the_hitbox_core_is_removed_and_reported() -> None:
    pool = _bullets((100.0, 200.0))
    assert resolve_bullets_vs_ship(pool, 100.0, 200.0, HITBOX_RADIUS)
    assert pool.n == 0


def test_bullet_edge_contact_with_the_core_counts() -> None:
    pool = _bullets((100.0 + BULLET_REACH, 200.0))
    assert resolve_bullets_vs_ship(pool, 100.0, 200.0, HITBOX_RADIUS)


def test_a_bullet_a_hair_past_the_core_is_a_miss_and_stays() -> None:
    pool = _bullets((100.0 + BULLET_REACH + 0.05, 200.0))
    assert not resolve_bullets_vs_ship(pool, 100.0, 200.0, HITBOX_RADIUS)
    assert pool.n == 1


def test_only_the_first_touching_bullet_is_removed() -> None:
    pool = _bullets((100.0, 200.0), (50.0, 50.0), (101.0, 200.0))
    assert resolve_bullets_vs_ship(pool, 100.0, 200.0, HITBOX_RADIUS)
    assert pool.n == 2
    assert resolve_bullets_vs_ship(pool, 100.0, 200.0, HITBOX_RADIUS)
    assert pool.n == 1
    assert not resolve_bullets_vs_ship(pool, 100.0, 200.0, HITBOX_RADIUS)


def test_no_bullets_means_no_hit() -> None:
    assert not resolve_bullets_vs_ship(BulletPool(8), 100.0, 200.0, HITBOX_RADIUS)


# --- enemy bodies versus the hitbox core --------------------------------------------------


def _enemies(kind: EnemyKind, x: float, y: float) -> EnemyPool:
    pool = EnemyPool()
    pool.spawn(kind, x, y, MotionKind.SWAY, 0.0, 0.0)
    return pool


def test_an_air_enemy_touching_the_hitbox_is_a_hit() -> None:
    pool = _enemies(EnemyKind.JET, 100.0, 200.0)
    assert resolve_bodies_vs_ship(pool, 100.0, 200.0, HITBOX_RADIUS)
    reach = ENEMY_RADIUS[EnemyKind.JET] + HITBOX_RADIUS
    pool = _enemies(EnemyKind.HELI, 100.0 + ENEMY_RADIUS[EnemyKind.HELI] + HITBOX_RADIUS, 200.0)
    assert resolve_bodies_vs_ship(pool, 100.0, 200.0, HITBOX_RADIUS)
    pool = _enemies(EnemyKind.JET, 100.0 + reach + 0.05, 200.0)
    assert not resolve_bodies_vs_ship(pool, 100.0, 200.0, HITBOX_RADIUS)


def test_a_ground_enemy_never_rams_the_ship() -> None:
    for kind in (EnemyKind.TANK, EnemyKind.TURRET):
        pool = _enemies(kind, 100.0, 200.0)
        assert not resolve_bodies_vs_ship(pool, 100.0, 200.0, HITBOX_RADIUS)


def test_a_dead_enemy_never_rams_the_ship() -> None:
    pool = _enemies(EnemyKind.CARRIER, 100.0, 200.0)
    pool.hp[0] = 0
    assert not resolve_bodies_vs_ship(pool, 100.0, 200.0, HITBOX_RADIUS)


def test_a_far_air_enemy_beside_a_touching_one_is_found() -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.TANK, 100.0, 200.0, MotionKind.GROUND, 0.0, 0.0)
    pool.spawn(EnemyKind.JET, 10.0, 10.0, MotionKind.SWAY, 0.0, 0.0)
    pool.spawn(EnemyKind.JET, 100.0 + math.sqrt(2.0), 200.0, MotionKind.SWAY, 0.0, 0.0)
    assert resolve_bodies_vs_ship(pool, 100.0, 200.0, HITBOX_RADIUS)
