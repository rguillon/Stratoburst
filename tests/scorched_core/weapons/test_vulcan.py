import math

import pytest

from scorched_core.events.event_ring import EventRing
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.protocol import EV_SHOT, EVENT_STRIDE
from scorched_core.tuning import (
    MAX_LEVEL,
    MUZZLE_AHEAD,
    PBULLET_SPEED,
    VULCAN_INTERVAL,
    VULCAN_STREAMS,
)
from scorched_core.weapons.vulcan import Vulcan
from scorched_core.weapons.weapon_kind import WeaponKind


def _fire(vulcan: Vulcan, pool: BulletPool, events: EventRing, *, firing: bool, level: int) -> int:
    return vulcan.step(firing, 100.0, 200.0, level, pool, events)


def test_the_level_tables_cover_every_level() -> None:
    assert len(VULCAN_STREAMS) == len(VULCAN_INTERVAL) == MAX_LEVEL
    assert [len(streams) for streams in VULCAN_STREAMS] == [2, 3, 5, 5, 7]
    assert VULCAN_INTERVAL == (5, 5, 5, 4, 4)


def test_the_first_fire_step_spawns_a_volley_immediately() -> None:
    pool, events = BulletPool(128), EventRing()
    assert _fire(Vulcan(), pool, events, firing=True, level=1) == 2
    assert pool.n == 2


def test_a_level_one_volley_is_two_parallel_bolts_five_units_either_side_and_ten_ahead() -> None:
    pool, events = BulletPool(128), EventRing()
    _fire(Vulcan(), pool, events, firing=True, level=1)
    assert (pool.x[0], pool.x[1]) == (95.0, 105.0)
    assert (pool.y[0], pool.y[1]) == (200.0 - MUZZLE_AHEAD, 200.0 - MUZZLE_AHEAD)
    assert (pool.vx[0], pool.vx[1]) == (0.0, 0.0)
    assert (pool.vy[0], pool.vy[1]) == (-PBULLET_SPEED, -PBULLET_SPEED)


def test_twin_shot_parity_sixty_held_steps_give_twenty_four_bolts_one_volley_per_five_steps() -> (
    None
):
    pool, events = BulletPool(128), EventRing()
    vulcan = Vulcan()
    spawned = [_fire(vulcan, pool, events, firing=True, level=1) for _ in range(60)]
    assert sum(spawned) == 24
    assert [i for i, count in enumerate(spawned) if count] == list(range(0, 60, 5))
    assert all((pool.vx[i], pool.vy[i]) == (0.0, -PBULLET_SPEED) for i in range(pool.n))


def test_not_firing_never_spawns() -> None:
    pool, events = BulletPool(128), EventRing()
    vulcan = Vulcan()
    assert sum(_fire(vulcan, pool, events, firing=False, level=3) for _ in range(20)) == 0
    assert pool.n == 0
    assert events.n == 0


def test_releasing_and_pressing_again_does_not_beat_the_fire_interval() -> None:
    pool, events = BulletPool(128), EventRing()
    vulcan = Vulcan()
    assert _fire(vulcan, pool, events, firing=True, level=1) == 2  # step 0
    assert _fire(vulcan, pool, events, firing=False, level=1) == 0  # step 1
    assert _fire(vulcan, pool, events, firing=False, level=1) == 0  # step 2
    assert _fire(vulcan, pool, events, firing=True, level=1) == 0  # step 3: still cooling
    assert _fire(vulcan, pool, events, firing=True, level=1) == 0  # step 4
    assert _fire(vulcan, pool, events, firing=True, level=1) == 2  # step 5
    assert pool.n == 4


def test_the_cooldown_runs_down_while_fire_is_released() -> None:
    pool, events = BulletPool(128), EventRing()
    vulcan = Vulcan()
    _fire(vulcan, pool, events, firing=True, level=1)
    for _ in range(10):
        _fire(vulcan, pool, events, firing=False, level=1)
    assert vulcan.cooldown == 0
    assert _fire(vulcan, pool, events, firing=True, level=1) == 2


@pytest.mark.parametrize("level", range(1, MAX_LEVEL + 1))
def test_every_level_fires_its_table_and_waits_its_interval(level: int) -> None:
    pool, events = BulletPool(128), EventRing()
    vulcan = Vulcan()
    interval = VULCAN_INTERVAL[level - 1]
    spawned = [_fire(vulcan, pool, events, firing=True, level=level) for _ in range(interval * 3)]
    expected = len(VULCAN_STREAMS[level - 1])
    assert [i for i, count in enumerate(spawned) if count] == [0, interval, interval * 2]
    assert sum(spawned) == expected * 3


def test_a_level_five_volley_is_seven_bolts_with_the_outer_pair_at_twenty_one_degrees() -> None:
    pool, events = BulletPool(128), EventRing()
    assert _fire(Vulcan(), pool, events, firing=True, level=5) == 7
    angle = math.radians(21.0)
    assert sorted(pool.vx[i] for i in range(7))[0] == pytest.approx(
        -math.sin(angle) * PBULLET_SPEED, rel=1e-6
    )
    assert sorted(pool.vx[i] for i in range(7))[-1] == pytest.approx(
        math.sin(angle) * PBULLET_SPEED, rel=1e-6
    )
    outer = max(range(7), key=lambda i: pool.vx[i])
    assert pool.vy[outer] == pytest.approx(-math.cos(angle) * PBULLET_SPEED, rel=1e-6)
    assert pool.x[outer] == 106.0
    centre = [i for i in range(7) if pool.vx[i] == 0.0]
    assert len(centre) == 1
    assert pool.vy[centre[0]] == -PBULLET_SPEED


def test_every_bolt_travels_at_the_bolt_speed() -> None:
    pool, events = BulletPool(128), EventRing()
    _fire(Vulcan(), pool, events, firing=True, level=5)
    for i in range(pool.n):
        assert math.hypot(pool.vx[i], pool.vy[i]) == pytest.approx(PBULLET_SPEED, rel=1e-6)


def test_a_full_pool_drops_the_volley_without_raising() -> None:
    pool, events = BulletPool(128), EventRing()
    for _ in range(128):
        assert pool.spawn(0.0, 0.0, 0.0, 0.0)
    assert _fire(Vulcan(), pool, events, firing=True, level=5) == 0
    assert pool.n == 128
    assert events.n == 0


def test_a_volley_that_does_not_fully_fit_spawns_what_fits() -> None:
    pool, events = BulletPool(5), EventRing()
    for _ in range(3):
        pool.spawn(0.0, 0.0, 0.0, 0.0)
    assert _fire(Vulcan(), pool, events, firing=True, level=5) == 2
    assert pool.n == 5
    assert events.n == 1


def test_a_dropped_volley_still_starts_the_cooldown() -> None:
    pool, events = BulletPool(2), EventRing()
    pool.spawn(0.0, 0.0, 0.0, 0.0)
    pool.spawn(0.0, 0.0, 0.0, 0.0)
    vulcan = Vulcan()
    _fire(vulcan, pool, events, firing=True, level=1)
    assert vulcan.cooldown == VULCAN_INTERVAL[0] - 1


def test_each_non_empty_volley_pushes_one_low_priority_vulcan_shot_event() -> None:
    pool, events = BulletPool(128), EventRing()
    _fire(Vulcan(), pool, events, firing=True, level=5)
    assert events.n == 1
    kind, x, y, a, b, c = events.buf[:EVENT_STRIDE]
    assert (kind, x, y, a, b, c) == (
        EV_SHOT,
        100.0,
        200.0 - MUZZLE_AHEAD,
        WeaponKind.VULCAN,
        0.0,
        0.0,
    )


def test_the_shot_event_is_low_priority_and_refused_once_the_soft_cap_is_reached() -> None:
    pool, events = BulletPool(128), EventRing()
    for _ in range(96):
        events.push(EV_SHOT, 0.0, 0.0)
    assert _fire(Vulcan(), pool, events, firing=True, level=1) == 2
    assert events.n == 96
    assert events.dropped == 1
