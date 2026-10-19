import math
from types import SimpleNamespace

import pytest

from scorched_core.patterns import bullet_patterns
from scorched_core.patterns.bullet_patterns import fire_aimed, run_pattern
from scorched_core.patterns.fire_pattern import FirePattern
from scorched_core.patterns.pattern_spec import PatternSpec
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


def _angles(pool: BulletPool) -> list[float]:
    return [float(pool.angle[k]) for k in range(pool.n)]


def _assert_angles(pool: BulletPool, expected: list[float]) -> None:
    assert pool.n == len(expected)
    for got, want in zip(_angles(pool), expected, strict=True):
        assert math.remainder(got - want, math.tau) == pytest.approx(0.0, abs=1e-5)


def test_a_spread_of_one_flies_straight_along_the_aim() -> None:
    pool = BulletPool(8)
    assert bullet_patterns.fire_spread(pool, 100.0, 50.0, math.pi / 2, 1, 40.0, 2.0) == 1
    _assert_angles(pool, [math.pi / 2])
    assert (pool.vx[0], pool.vy[0]) == pytest.approx((2.0, 0.0), abs=1e-6)
    assert (pool.x[0], pool.y[0]) == (100.0, 50.0)


def test_a_spread_fans_evenly_across_the_arc_centred_on_the_aim() -> None:
    pool = BulletPool(8)
    assert bullet_patterns.fire_spread(pool, 0.0, 0.0, 0.0, 5, 80.0, 1.5) == 5
    _assert_angles(pool, [math.radians(a) for a in (-40.0, -20.0, 0.0, 20.0, 40.0)])
    assert all(math.hypot(pool.vx[k], pool.vy[k]) == pytest.approx(1.5) for k in range(pool.n))


def test_a_spread_into_a_nearly_full_pool_spawns_what_fits() -> None:
    pool = BulletPool(2)
    assert bullet_patterns.fire_spread(pool, 0.0, 0.0, 0.0, 5, 60.0, 1.0) == 2
    assert bullet_patterns.fire_spread(pool, 0.0, 0.0, 0.0, 5, 60.0, 1.0) == 0


def test_run_pattern_aimed_spawns_one_bullet_towards_the_target() -> None:
    pool = BulletPool(8)
    spec = PatternSpec(FirePattern.AIMED, speed=2.0)
    assert run_pattern(spec, pool, 100.0, 200.0, 100.0, 40.0, 0) == 1
    assert (pool.vx[0], pool.vy[0]) == pytest.approx((0.0, -2.0))


def test_run_pattern_aimed_rotates_by_the_aim_offset() -> None:
    pool = BulletPool(8)
    spec = PatternSpec(FirePattern.AIMED, speed=2.0, aim_offset_deg=90.0)
    assert run_pattern(spec, pool, 100.0, 200.0, 100.0, 40.0, 0) == 1  # target straight up
    assert (pool.vx[0], pool.vy[0]) == pytest.approx((2.0, 0.0), abs=1e-6)


def test_run_pattern_spread_fans_around_the_direction_of_the_target() -> None:
    pool = BulletPool(8)
    spec = PatternSpec(FirePattern.SPREAD, count=3, arc_deg=40.0, speed=1.5)
    assert run_pattern(spec, pool, 100.0, 50.0, 100.0, 250.0, 7) == 3  # target straight down
    _assert_angles(pool, [math.pi - math.radians(20.0), math.pi, math.pi + math.radians(20.0)])


def test_run_pattern_spread_at_a_target_on_the_muzzle_aims_straight_down() -> None:
    pool = BulletPool(8)
    spec = PatternSpec(FirePattern.SPREAD, count=1, speed=1.0)
    assert run_pattern(spec, pool, 100.0, 50.0, 100.0, 50.0, 0) == 1
    assert (pool.vx[0], pool.vy[0]) == pytest.approx((0.0, 1.0), abs=1e-6)


def test_run_pattern_spread_offset_turns_the_whole_fan() -> None:
    pool = BulletPool(8)
    spec = PatternSpec(FirePattern.SPREAD, count=1, speed=1.0, aim_offset_deg=90.0)
    run_pattern(spec, pool, 100.0, 200.0, 100.0, 40.0, 0)  # aim straight up, turned right
    assert (pool.vx[0], pool.vy[0]) == pytest.approx((1.0, 0.0), abs=1e-6)


def test_run_pattern_ring_spawns_count_bullets_and_rotates_by_the_phase_step() -> None:
    spec = PatternSpec(FirePattern.RING, count=8, speed=1.3, phase_step_deg=22.5)
    pool = BulletPool(64)
    assert run_pattern(spec, pool, 0.0, 0.0, 50.0, 50.0, 0) == 8
    assert run_pattern(spec, pool, 0.0, 0.0, 50.0, 50.0, 1) == 8
    assert run_pattern(spec, pool, 0.0, 0.0, 50.0, 50.0, 2) == 8
    assert pool.angle[0] == pytest.approx(0.0, abs=1e-6)
    assert pool.angle[8] == pytest.approx(math.radians(22.5), abs=1e-6)
    assert pool.angle[16] == pytest.approx(0.0, abs=1e-6)  # 45 degrees is one full ring step


def test_run_pattern_stream_spawns_one_aimed_bullet_per_call() -> None:
    pool = BulletPool(8)
    spec = PatternSpec(FirePattern.STREAM, speed=1.7, burst=3, burst_gap=8)
    assert run_pattern(spec, pool, 100.0, 200.0, 100.0, 40.0, 5) == 1
    assert (pool.vx[0], pool.vy[0]) == pytest.approx((0.0, -1.7))


def test_run_pattern_into_a_full_pool_spawns_what_fits() -> None:
    pool = BulletPool(3)
    spec = PatternSpec(FirePattern.RING, count=10, speed=1.0)
    assert run_pattern(spec, pool, 0.0, 0.0, 1.0, 1.0, 0) == 3


def test_run_pattern_fails_loudly_on_an_unknown_shape() -> None:
    bogus = SimpleNamespace(shape=99)
    with pytest.raises(ValueError, match="unknown pattern shape 99"):
        run_pattern(bogus, BulletPool(4), 0.0, 0.0, 1.0, 1.0, 0)  # type: ignore[arg-type]
