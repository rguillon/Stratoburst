import random

import pytest

from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.protocol import PLAYFIELD_H, PLAYFIELD_W
from scorched_core.stress.bullet_storm import BulletStorm
from scorched_core.tuning import STORM_RADIUS, STORM_SPEED_MAX, STORM_SPEED_MIN

FAR = (-1000.0, -1000.0, 1.0)  # a target nothing can touch


def make_storm(count: int, seed: int = 1) -> tuple[BulletStorm, BulletPool]:
    pool = BulletPool(max(count, 8))
    return BulletStorm(pool, count, random.Random(seed)), pool  # noqa: S311


def test_storm_spawns_the_requested_count_inside_the_playfield() -> None:
    _, pool = make_storm(200)
    assert pool.n == 200
    for i in range(pool.n):
        assert STORM_RADIUS <= pool.x[i] <= PLAYFIELD_W - STORM_RADIUS
        assert STORM_RADIUS <= pool.y[i] <= PLAYFIELD_H - STORM_RADIUS


def test_storm_speeds_stay_within_the_tuned_band() -> None:
    _, pool = make_storm(200)
    for i in range(pool.n):
        speed = (pool.vx[i] ** 2 + pool.vy[i] ** 2) ** 0.5
        assert STORM_SPEED_MIN - 1e-4 <= speed <= STORM_SPEED_MAX + 1e-4


def test_zero_count_storm_is_empty_and_steps_cleanly() -> None:
    storm, pool = make_storm(0)
    assert pool.n == 0
    assert storm.step(*FAR) == 0


def test_bullets_stay_inside_after_many_steps() -> None:
    storm, pool = make_storm(100)
    for _ in range(2000):
        storm.step(*FAR)
    for i in range(pool.n):
        assert STORM_RADIUS - 1e-4 <= pool.x[i] <= PLAYFIELD_W - STORM_RADIUS + 1e-4
        assert STORM_RADIUS - 1e-4 <= pool.y[i] <= PLAYFIELD_H - STORM_RADIUS + 1e-4


@pytest.mark.parametrize(
    ("start", "velocity", "expected_sign"),
    [
        ((STORM_RADIUS + 0.5, 100.0), (-2.0, 0.0), (1, 0)),  # left wall
        ((PLAYFIELD_W - STORM_RADIUS - 0.5, 100.0), (2.0, 0.0), (-1, 0)),  # right wall
        ((100.0, STORM_RADIUS + 0.5), (0.0, -2.0), (0, 1)),  # top wall
        ((100.0, PLAYFIELD_H - STORM_RADIUS - 0.5), (0.0, 2.0), (0, -1)),  # bottom wall
    ],
)
def test_bounce_reflects_the_velocity_component_inward(
    start: tuple[float, float], velocity: tuple[float, float], expected_sign: tuple[int, int]
) -> None:
    storm, pool = make_storm(0)
    pool.spawn(start[0], start[1], velocity[0], velocity[1])
    storm.step(*FAR)
    if expected_sign[0]:
        assert pool.vx[0] * expected_sign[0] > 0
    if expected_sign[1]:
        assert pool.vy[0] * expected_sign[1] > 0
    assert STORM_RADIUS <= pool.x[0] <= PLAYFIELD_W - STORM_RADIUS
    assert STORM_RADIUS <= pool.y[0] <= PLAYFIELD_H - STORM_RADIUS


def test_step_counts_bullets_touching_the_target() -> None:
    storm, pool = make_storm(0)
    pool.spawn(100.0, 100.0, 0.0, 0.0)  # on the target
    pool.spawn(101.0, 100.0, 0.0, 0.0)  # overlapping
    pool.spawn(200.0, 250.0, 0.0, 0.0)  # far away
    assert storm.step(100.0, 100.0, 2.0) == 2


def test_step_hit_is_inclusive_at_exactly_the_radius_sum() -> None:
    storm, pool = make_storm(0)
    pool.spawn(104.5, 100.0, 0.0, 0.0)  # exactly STORM_RADIUS + 2.0 away
    assert storm.step(100.0, 100.0, 2.0) == 1


def test_step_misses_just_beyond_the_radius_sum() -> None:
    storm, pool = make_storm(0)
    pool.spawn(104.75, 100.0, 0.0, 0.0)
    assert storm.step(100.0, 100.0, 2.0) == 0


def test_same_seed_builds_the_same_storm_and_other_seeds_differ() -> None:
    _, a = make_storm(50, seed=3)
    _, b = make_storm(50, seed=3)
    _, c = make_storm(50, seed=4)
    assert a.x.tobytes() == b.x.tobytes()
    assert a.x.tobytes() != c.x.tobytes()
