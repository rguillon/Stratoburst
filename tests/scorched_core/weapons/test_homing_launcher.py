import math

import pytest

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.pools.missile_pool import MissilePool
from scorched_core.protocol import EV_SHOT, EVENT_STRIDE
from scorched_core.tuning import (
    HOMING_FAN_DEG,
    HOMING_INTERVAL,
    HOMING_MUZZLE_AHEAD,
    HOMING_VOLLEY,
    MAX_LEVEL,
)
from scorched_core.weapons.homing_launcher import HomingLauncher
from scorched_core.weapons.weapon_kind import WeaponKind


def _fire(
    launcher: HomingLauncher,
    missiles: MissilePool,
    enemies: EnemyPool,
    events: EventRing,
    *,
    firing: bool = True,
    level: int = 1,
) -> int:
    return launcher.step(firing, 100.0, 200.0, level, missiles, enemies, events)


def test_the_level_tables_cover_every_level() -> None:
    assert len(HOMING_VOLLEY) == len(HOMING_INTERVAL) == MAX_LEVEL
    assert HOMING_VOLLEY == (1, 2, 3, 4, 5)
    assert HOMING_INTERVAL == (14, 14, 13, 12, 12)


def test_a_level_one_volley_is_one_missile_straight_up_from_four_units_ahead() -> None:
    missiles, enemies, events = MissilePool(), EnemyPool(), EventRing()
    assert _fire(HomingLauncher(), missiles, enemies, events) == 1
    assert missiles.n == 1
    assert (missiles.x[0], missiles.y[0], missiles.angle[0]) == (
        100.0,
        200.0 - HOMING_MUZZLE_AHEAD,
        0.0,
    )


def test_the_missile_is_pre_targeted_at_the_enemy_nearest_the_ship() -> None:
    missiles, enemies, events = MissilePool(), EnemyPool(), EventRing()
    enemies.spawn(EnemyKind.JET, 20.0, 20.0, MotionKind.DIVE, 0.0, 0.0)
    enemies.spawn(EnemyKind.JET, 110.0, 120.0, MotionKind.DIVE, 0.0, 0.0)
    _fire(HomingLauncher(), missiles, enemies, events)
    assert missiles.target[0] == enemies.uid[1]


def test_with_no_enemy_the_missile_has_no_target() -> None:
    missiles, enemies, events = MissilePool(), EnemyPool(), EventRing()
    _fire(HomingLauncher(), missiles, enemies, events)
    assert missiles.target[0] == 0


def test_not_firing_never_launches() -> None:
    missiles, enemies, events = MissilePool(), EnemyPool(), EventRing()
    launcher = HomingLauncher()
    launched = sum(
        _fire(launcher, missiles, enemies, events, firing=False, level=3) for _ in range(30)
    )
    assert launched == 0
    assert missiles.n == 0
    assert events.n == 0


def test_releasing_and_pressing_again_does_not_beat_the_fire_interval() -> None:
    missiles, enemies, events = MissilePool(), EnemyPool(), EventRing()
    launcher = HomingLauncher()
    assert _fire(launcher, missiles, enemies, events) == 1  # step 0
    for _ in range(HOMING_INTERVAL[0] - 1):
        assert _fire(launcher, missiles, enemies, events, firing=True) == 0  # still cooling
    assert _fire(launcher, missiles, enemies, events) == 1  # step 14


def test_the_cooldown_runs_down_while_fire_is_released() -> None:
    missiles, enemies, events = MissilePool(), EnemyPool(), EventRing()
    launcher = HomingLauncher()
    _fire(launcher, missiles, enemies, events)
    for _ in range(HOMING_INTERVAL[0]):
        _fire(launcher, missiles, enemies, events, firing=False)
    assert launcher.cooldown == 0
    assert _fire(launcher, missiles, enemies, events) == 1


@pytest.mark.parametrize("level", range(1, MAX_LEVEL + 1))
def test_every_level_launches_its_count_and_waits_its_interval(level: int) -> None:
    missiles, enemies, events = MissilePool(), EnemyPool(), EventRing()
    launcher = HomingLauncher()
    interval = HOMING_INTERVAL[level - 1]
    launched = [
        _fire(launcher, missiles, enemies, events, level=level) for _ in range(interval * 3)
    ]
    assert [i for i, count in enumerate(launched) if count] == [0, interval, interval * 2]
    assert sum(launched) == HOMING_VOLLEY[level - 1] * 3


def test_a_level_five_volley_fans_out_at_zero_and_plus_minus_22_and_44_degrees() -> None:
    missiles, enemies, events = MissilePool(), EnemyPool(), EventRing()
    assert _fire(HomingLauncher(), missiles, enemies, events, level=5) == 5
    degrees = sorted(round(math.degrees(missiles.angle[i]), 3) for i in range(5))
    assert degrees == pytest.approx([-44.0, -22.0, 0.0, 22.0, 44.0], abs=1e-4)
    assert HOMING_FAN_DEG == 22.0


def test_a_level_two_volley_is_centred_so_the_pair_sits_eleven_degrees_either_side() -> None:
    missiles, enemies, events = MissilePool(), EnemyPool(), EventRing()
    _fire(HomingLauncher(), missiles, enemies, events, level=2)
    degrees = sorted(math.degrees(missiles.angle[i]) for i in range(2))
    assert degrees == pytest.approx([-11.0, 11.0], abs=1e-4)


def test_every_missile_of_a_volley_starts_at_the_muzzle() -> None:
    missiles, enemies, events = MissilePool(), EnemyPool(), EventRing()
    _fire(HomingLauncher(), missiles, enemies, events, level=4)
    assert {(missiles.x[i], missiles.y[i]) for i in range(4)} == {(100.0, 196.0)}


def test_a_full_pool_drops_the_volley_without_raising() -> None:
    missiles, enemies, events = MissilePool(3), EnemyPool(), EventRing()
    for _ in range(3):
        missiles.spawn(0.0, 0.0, 0.0, 0)
    assert _fire(HomingLauncher(), missiles, enemies, events, level=5) == 0
    assert missiles.n == 3
    assert events.n == 0


def test_a_volley_that_does_not_fully_fit_launches_the_central_missiles() -> None:
    missiles, enemies, events = MissilePool(3), EnemyPool(), EventRing()
    missiles.spawn(0.0, 0.0, 0.0, 0)
    assert _fire(HomingLauncher(), missiles, enemies, events, level=5) == 2
    assert missiles.n == 3
    assert sorted(round(math.degrees(missiles.angle[i])) for i in (1, 2)) == [-22, 0]
    assert events.n == 1


def test_a_dropped_volley_still_starts_the_cooldown() -> None:
    missiles, enemies, events = MissilePool(1), EnemyPool(), EventRing()
    missiles.spawn(0.0, 0.0, 0.0, 0)
    launcher = HomingLauncher()
    _fire(launcher, missiles, enemies, events)
    assert launcher.cooldown == HOMING_INTERVAL[0] - 1


def test_each_non_empty_volley_pushes_one_low_priority_homing_shot_event() -> None:
    missiles, enemies, events = MissilePool(), EnemyPool(), EventRing()
    _fire(HomingLauncher(), missiles, enemies, events, level=5)
    assert events.n == 1
    kind, x, y, a, b, c = events.buf[:EVENT_STRIDE]
    assert (kind, x, y, a, b, c) == (
        EV_SHOT,
        100.0,
        200.0 - HOMING_MUZZLE_AHEAD,
        WeaponKind.HOMING,
        0.0,
        0.0,
    )


def test_the_shot_event_is_refused_once_the_soft_cap_is_reached() -> None:
    missiles, enemies, events = MissilePool(), EnemyPool(), EventRing()
    for _ in range(96):
        events.push(EV_SHOT, 0.0, 0.0)
    assert _fire(HomingLauncher(), missiles, enemies, events) == 1
    assert events.n == 96
    assert events.dropped == 1
