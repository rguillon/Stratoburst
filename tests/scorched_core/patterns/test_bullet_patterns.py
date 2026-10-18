import math

import pytest

from scorched_core.patterns import bullet_patterns
from scorched_core.patterns.bullet_patterns import fire_aimed
from scorched_core.pools.bullet_pool import BulletPool


def test_an_aimed_shot_flies_at_the_target_with_the_given_speed() -> None:
    pool = BulletPool(4)
    assert fire_aimed(pool, 100.0, 50.0, 130.0, 90.0, 5.0) == 1
    assert pool.n == 1
    assert (pool.x[0], pool.y[0]) == (100.0, 50.0)
    assert math.hypot(pool.vx[0], pool.vy[0]) == pytest.approx(5.0)
    assert (pool.vx[0], pool.vy[0]) == pytest.approx((3.0, 4.0))


def test_an_aimed_shot_at_a_target_straight_above_flies_up() -> None:
    pool = BulletPool(4)
    fire_aimed(pool, 100.0, 200.0, 100.0, 40.0, 2.0)
    assert (pool.vx[0], pool.vy[0]) == pytest.approx((0.0, -2.0))


def test_an_aimed_shot_at_its_own_muzzle_flies_straight_down() -> None:
    pool = BulletPool(4)
    assert fire_aimed(pool, 100.0, 50.0, 100.0, 50.0, 1.8) == 1
    assert (pool.vx[0], pool.vy[0]) == pytest.approx((0.0, 1.8))


def test_an_aimed_shot_into_a_full_pool_spawns_nothing() -> None:
    pool = BulletPool(1)
    assert fire_aimed(pool, 10.0, 10.0, 50.0, 50.0, 2.0) == 1
    assert fire_aimed(pool, 10.0, 10.0, 50.0, 50.0, 2.0) == 0
    assert pool.n == 1


def test_a_ring_spawns_count_bullets_evenly_spaced_from_the_phase() -> None:
    pool = BulletPool(32)
    assert bullet_patterns.fire_ring(pool, 100.0, 80.0, 8, 1.3, 0.0) == 8
    assert pool.n == 8
    for k in range(8):
        assert (pool.x[k], pool.y[k]) == (100.0, 80.0)
        assert math.hypot(pool.vx[k], pool.vy[k]) == pytest.approx(1.3)
        assert pool.angle[k] == pytest.approx(math.remainder(k * math.tau / 8, math.tau))


def test_a_ring_with_phase_zero_starts_straight_up_and_a_phase_rotates_it() -> None:
    pool = BulletPool(32)
    bullet_patterns.fire_ring(pool, 0.0, 0.0, 8, 2.0, 0.0)
    assert (pool.vx[0], pool.vy[0]) == pytest.approx((0.0, -2.0))
    bullet_patterns.fire_ring(pool, 0.0, 0.0, 8, 2.0, math.pi / 8)
    assert pool.angle[8] == pytest.approx(math.pi / 8)


def test_a_ring_into_a_nearly_full_pool_spawns_what_fits() -> None:
    pool = BulletPool(5)
    assert bullet_patterns.fire_ring(pool, 0.0, 0.0, 8, 1.0, 0.0) == 5
    assert pool.n == 5
    assert bullet_patterns.fire_ring(pool, 0.0, 0.0, 8, 1.0, 0.0) == 0
