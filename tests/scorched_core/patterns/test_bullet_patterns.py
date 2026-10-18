import math

import pytest

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
