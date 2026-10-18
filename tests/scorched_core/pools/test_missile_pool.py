import math
from array import array

import pytest

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.pools.missile_pool import MissilePool
from scorched_core.protocol import MISSILE_CAP, PLAYFIELD_H, PLAYFIELD_W
from scorched_core.tuning import (
    HOMING_LIFE_TICKS,
    HOMING_RETARGET_TICKS,
    HOMING_SPEED,
    HOMING_TURN_DEG,
)

TURN = math.radians(HOMING_TURN_DEG)


def enemy_at(pool: EnemyPool, x: float, y: float) -> int:
    """Spawn a motionless jet and return its uid."""
    assert pool.spawn(EnemyKind.JET, x, y, MotionKind.DIVE, 0.0, 0.0)
    return int(pool.uid[pool.n - 1])


def test_a_new_pool_is_empty_and_holds_the_protocol_capacity() -> None:
    pool = MissilePool()
    assert pool.n == 0
    assert pool.capacity == MISSILE_CAP == 48


def test_spawn_fills_a_row_and_respects_capacity() -> None:
    pool = MissilePool(2)
    assert pool.spawn(10.0, 20.0, 0.5, 7)
    assert (pool.x[0], pool.y[0], pool.angle[0], pool.target[0], pool.life[0]) == (
        10.0,
        20.0,
        0.5,
        7,
        0,
    )
    assert pool.retarget[0] == HOMING_RETARGET_TICKS
    assert pool.spawn(0.0, 0.0, 0.0, 0)
    assert not pool.spawn(0.0, 0.0, 0.0, 0)
    assert pool.n == 2


def test_remove_at_swaps_the_last_missile_into_the_slot() -> None:
    pool = MissilePool(4)
    for i in range(3):
        pool.spawn(float(i), float(i), float(i), i + 1)
    pool.life[2] = 9
    pool.retarget[2] = 5
    pool.remove_at(0)
    assert pool.n == 2
    assert (pool.x[0], pool.angle[0], pool.target[0], pool.life[0], pool.retarget[0]) == (
        2.0,
        2.0,
        3,
        9,
        5,
    )
    pool.remove_at(1)  # the last slot just shrinks
    assert pool.n == 1


def test_nearest_uid_picks_the_closest_live_enemy() -> None:
    enemies = EnemyPool()
    enemy_at(enemies, 20.0, 20.0)
    near = enemy_at(enemies, 100.0, 90.0)
    enemy_at(enemies, 200.0, 20.0)
    assert MissilePool().nearest_uid(enemies, 100.0, 100.0) == near


def test_nearest_uid_skips_dead_enemies_and_returns_zero_when_there_is_none() -> None:
    pool = MissilePool()
    enemies = EnemyPool()
    assert pool.nearest_uid(enemies, 0.0, 0.0) == 0
    enemy_at(enemies, 100.0, 90.0)
    far = enemy_at(enemies, 200.0, 20.0)
    enemies.hp[0] = 0
    assert pool.nearest_uid(enemies, 100.0, 100.0) == far


def test_an_untargeted_missile_flies_straight_at_the_homing_speed_along_its_angle() -> None:
    pool = MissilePool()
    pool.spawn(100.0, 200.0, 0.0, 0)
    pool.steer(EnemyPool())
    assert (pool.x[0], pool.y[0]) == (100.0, pytest.approx(200.0 - HOMING_SPEED))
    assert pool.angle[0] == 0.0
    sideways = MissilePool()
    sideways.spawn(100.0, 200.0, math.pi / 2, 0)  # heading right
    sideways.steer(EnemyPool())
    assert sideways.x[0] == pytest.approx(100.0 + HOMING_SPEED, rel=1e-6)
    assert sideways.y[0] == pytest.approx(200.0, abs=1e-4)


def test_turn_rate_limits_a_missile_to_five_degrees_per_step_until_aligned() -> None:
    enemies = EnemyPool()
    uid = enemy_at(enemies, 220.0, 200.0)  # level with the missile, 90 degrees to its right
    pool = MissilePool()
    pool.spawn(100.0, 200.0, 0.0, uid)
    for step in range(1, 4):
        before = float(pool.angle[0])
        pool.steer(enemies)
        assert pool.angle[0] - before == pytest.approx(TURN, rel=1e-4)
        assert pool.angle[0] == pytest.approx(step * TURN, rel=1e-4)


def test_a_missile_stops_turning_once_it_points_at_the_target() -> None:
    enemies = EnemyPool()
    uid = enemy_at(enemies, 100.0, 50.0)  # dead ahead
    pool = MissilePool()
    pool.spawn(100.0, 200.0, 0.0, uid)
    pool.steer(enemies)
    assert pool.angle[0] == 0.0
    assert pool.x[0] == pytest.approx(100.0)


def test_the_turn_wraps_the_short_way_across_plus_minus_pi() -> None:
    enemies = EnemyPool()
    uid = enemy_at(enemies, 80.0, 300.0)  # wanted heading is about -168.7 degrees
    pool = MissilePool()
    pool.spawn(100.0, 200.0, math.radians(178.0), uid)
    pool.steer(enemies)
    # the long way round is 346.7 degrees negative; the short way is 13.3 positive, clamped to 5,
    # which crosses +pi and comes out as -177 degrees
    assert pool.angle[0] == pytest.approx(math.radians(-177.0), abs=1e-4)


def test_the_turn_wraps_the_short_way_across_minus_pi_to_pi() -> None:
    enemies = EnemyPool()
    uid = enemy_at(enemies, 120.0, 300.0)  # wanted heading is about +168.7 degrees
    pool = MissilePool()
    pool.spawn(100.0, 200.0, math.radians(-178.0), uid)
    pool.steer(enemies)
    assert pool.angle[0] == pytest.approx(math.radians(177.0), abs=1e-4)


def test_the_heading_stays_wrapped_into_minus_pi_to_pi_through_a_long_chase() -> None:
    enemies = EnemyPool()
    uid = enemy_at(enemies, 100.0, 300.0)  # behind the missile: it must swing round
    pool = MissilePool()
    pool.spawn(100.0, 200.0, math.radians(100.0), uid)
    for _ in range(30):
        pool.steer(enemies)
        assert pool.n == 1
        assert -math.pi <= pool.angle[0] <= math.pi


def test_a_missile_tracks_its_target_as_the_target_moves() -> None:
    enemies = EnemyPool()
    uid = enemy_at(enemies, 220.0, 200.0)
    pool = MissilePool()
    pool.spawn(100.0, 200.0, 0.0, uid)
    pool.steer(enemies)
    first = float(pool.angle[0])
    enemies.x[0] = 0.0  # the target jumps to the other side
    pool.steer(enemies)
    assert pool.angle[0] < first


def test_a_missile_whose_target_is_gone_flies_straight() -> None:
    enemies = EnemyPool()
    pool = MissilePool()
    pool.spawn(100.0, 200.0, 0.3, 999)  # no enemy has this uid
    pool.steer(enemies)
    assert pool.angle[0] == pytest.approx(0.3)


def test_a_missile_is_removed_when_its_lifetime_runs_out() -> None:
    pool = MissilePool()
    pool.spawn(120.0, 160.0, 0.0, 0)
    pool.life[0] = HOMING_LIFE_TICKS - 2
    pool.steer(EnemyPool())
    assert pool.n == 1
    pool.steer(EnemyPool())
    assert pool.n == 0


def test_a_missile_leaving_the_playfield_is_culled() -> None:
    pool = MissilePool()
    pool.spawn(100.0, 0.0, 0.0, 0)  # heads straight up and off the top
    for _ in range(3):
        pool.steer(EnemyPool())
    assert pool.n == 1  # 13.5 units above the top is still within the margin
    pool.steer(EnemyPool())
    assert pool.n == 0


def test_the_pool_survives_swap_removals_while_steering() -> None:
    pool = MissilePool()
    pool.spawn(100.0, 2.0, 0.0, 0)  # about to leave
    pool.spawn(50.0, 100.0, 0.0, 0)
    pool.spawn(60.0, 2.0, 0.0, 0)  # about to leave
    for _ in range(6):
        pool.steer(EnemyPool())
    assert pool.n == 1
    assert pool.x[0] == 50.0


def test_pack_into_writes_x_y_angle_and_life_fraction_at_stride_four() -> None:
    pool = MissilePool()
    pool.spawn(10.0, 100.0, 0.0, 0)
    pool.spawn(20.0, 110.0, 0.0, 0)
    pool.life[1] = 45
    out = array("f", [-7.0] * 16)
    pool.pack_into(out)
    assert list(out[:8]) == pytest.approx([10.0, 100.0, 0.0, 0.0, 20.0, 110.0, 0.0, 0.5])
    assert list(out[8:]) == [-7.0] * 8


# --- acquisition ---------------------------------------------------------------------------


def test_a_missile_follows_its_target_by_uid_through_a_swap_remove() -> None:
    enemies = EnemyPool()
    first = enemy_at(enemies, 40.0, 100.0)
    second = enemy_at(enemies, 200.0, 100.0)
    third = enemy_at(enemies, 120.0, 40.0)
    pool = MissilePool()
    pool.spawn(120.0, 200.0, 0.0, second)
    enemies.hp[0] = 0  # the first enemy dies: the third takes slot 0, the second stays at 1
    enemies.remove_dead(EventRing())
    assert enemies.index_of_uid(third) == 0
    pool.steer(enemies)
    assert pool.target[0] == second  # still the second enemy, not the newcomer in slot 0
    assert pool.angle[0] > 0.0  # and it turns toward the second, which is to the right
    assert first not in {int(enemies.uid[i]) for i in range(enemies.n)}


def test_a_missile_whose_target_died_re_acquires_a_different_uid() -> None:
    enemies = EnemyPool()
    enemy_at(enemies, 40.0, 100.0)
    second = enemy_at(enemies, 200.0, 100.0)
    enemy_at(enemies, 120.0, 40.0)
    pool = MissilePool()
    pool.spawn(120.0, 200.0, 0.0, second)
    enemies.hp[1] = 0
    enemies.remove_dead(EventRing())  # the second is gone: the third takes slot 1
    pool.steer(enemies)
    assert pool.target[0] != second  # its target died, so it re-acquired a different uid


def test_a_missile_re_acquires_at_once_when_its_target_is_gone() -> None:
    enemies = EnemyPool()
    survivor = enemy_at(enemies, 100.0, 80.0)
    pool = MissilePool()
    pool.spawn(100.0, 200.0, 0.0, 999)  # the target uid no longer exists
    pool.steer(enemies)
    assert pool.target[0] == survivor
    assert pool.retarget[0] == HOMING_RETARGET_TICKS


def test_a_missile_re_acquires_every_eight_steps() -> None:
    enemies = EnemyPool()
    far = enemy_at(enemies, 200.0, 40.0)
    pool = MissilePool()
    pool.spawn(100.0, 200.0, 0.0, far)
    near = enemy_at(enemies, 100.0, 150.0)  # appears after launch, nearer than the target
    for _ in range(HOMING_RETARGET_TICKS - 1):
        pool.steer(enemies)
        assert pool.target[0] == far  # not yet due
    pool.steer(enemies)
    assert pool.target[0] == near
    assert pool.retarget[0] == HOMING_RETARGET_TICKS


def test_acquisition_ignores_dead_and_off_screen_enemies() -> None:
    enemies = EnemyPool()
    enemy_at(enemies, 100.0, 190.0)  # dead
    enemy_at(enemies, 100.0, -12.0)  # still above the playfield
    enemy_at(enemies, -5.0, 150.0)  # off the left edge
    enemy_at(enemies, PLAYFIELD_W + 1.0, 150.0)  # off the right edge
    enemy_at(enemies, 100.0, PLAYFIELD_H + 1.0)  # below the playfield
    on_screen = enemy_at(enemies, 220.0, 20.0)
    enemies.hp[0] = 0
    assert MissilePool().nearest_uid(enemies, 100.0, 200.0) == on_screen


def test_acquisition_accepts_enemies_exactly_on_the_playfield_edges() -> None:
    for x, y in ((0.0, 100.0), (PLAYFIELD_W, 100.0), (100.0, 0.0), (100.0, PLAYFIELD_H)):
        enemies = EnemyPool()
        uid = enemy_at(enemies, x, y)
        assert MissilePool().nearest_uid(enemies, 100.0, 100.0) == uid


def test_a_tie_in_distance_goes_to_the_lower_pool_index() -> None:
    enemies = EnemyPool()
    left = enemy_at(enemies, 60.0, 100.0)
    enemy_at(enemies, 140.0, 100.0)  # exactly as far from x = 100
    assert MissilePool().nearest_uid(enemies, 100.0, 100.0) == left
    enemies = EnemyPool()
    enemy_at(enemies, 140.0, 100.0)
    right_first = int(enemies.uid[0])
    enemy_at(enemies, 60.0, 100.0)
    assert MissilePool().nearest_uid(enemies, 100.0, 100.0) == right_first


def test_with_no_live_on_screen_enemy_the_missile_flies_straight_and_clears_its_target() -> None:
    enemies = EnemyPool()
    enemy_at(enemies, 100.0, -12.0)  # off-screen above: not acquirable
    pool = MissilePool()
    pool.spawn(100.0, 200.0, 0.3, 999)
    pool.steer(enemies)
    assert pool.target[0] == 0
    assert pool.angle[0] == pytest.approx(0.3)
    assert pool.x[0] == pytest.approx(100.0 + math.sin(0.3) * HOMING_SPEED, rel=1e-6)


def test_an_untargeted_missile_waits_for_its_retarget_timer_before_looking_again() -> None:
    enemies = EnemyPool()
    pool = MissilePool()
    pool.spawn(100.0, 250.0, 0.0, 0)
    pool.steer(enemies)
    late = enemy_at(enemies, 100.0, 150.0)  # appears while the missile has no target
    for _ in range(HOMING_RETARGET_TICKS - 2):
        pool.steer(enemies)
        assert pool.target[0] == 0
    pool.steer(enemies)
    assert pool.target[0] == late


def test_a_missile_is_removed_on_exactly_the_ninetieth_step() -> None:
    pool = MissilePool()
    pool.spawn(120.0, 160.0, 0.0, 0)
    pool.life[0] = HOMING_LIFE_TICKS - 1
    pool.y[0] = 160.0
    pool.steer(EnemyPool())
    assert pool.n == 0


def test_a_missile_circling_a_target_expires_after_ninety_steps() -> None:
    enemies = EnemyPool()
    uid = enemy_at(enemies, 120.0, 160.0)
    pool = MissilePool()
    pool.spawn(120.0, 160.0, 0.0, uid)  # on top of its target: it never leaves the field
    for _ in range(HOMING_LIFE_TICKS - 1):
        pool.steer(enemies)
    assert pool.n == 1
    pool.steer(enemies)
    assert pool.n == 0


def test_every_cull_edge_removes_a_missile_sixteen_units_outside() -> None:
    cases = (
        (-20.0, 100.0, -math.pi / 2),
        (PLAYFIELD_W + 20.0, 100.0, math.pi / 2),
        (100.0, -20.0, 0.0),
        (100.0, PLAYFIELD_H + 20.0, math.pi),
    )
    for x, y, angle in cases:
        pool = MissilePool()
        pool.spawn(x, y, angle, 0)
        pool.steer(EnemyPool())
        assert pool.n == 0, (x, y)


def test_pack_into_is_finite_for_every_live_missile_after_a_chase() -> None:
    enemies = EnemyPool()
    uid = enemy_at(enemies, 200.0, 60.0)
    pool = MissilePool()
    for k in range(6):
        pool.spawn(100.0 + k, 250.0, math.radians(-40.0 + 16.0 * k), uid)
    out = array("f", bytes(4 * 4 * MISSILE_CAP))
    for _ in range(30):
        pool.steer(enemies)
        pool.pack_into(out)
        assert all(math.isfinite(v) for v in out)
    assert 0.0 < out[3] < 1.0


def test_clear_empties_the_pool() -> None:
    pool = MissilePool(4)
    pool.spawn(1.0, 2.0, 0.0, 7)
    pool.spawn(3.0, 4.0, 0.0, 8)
    pool.clear()
    assert pool.n == 0
    assert pool.spawn(5.0, 6.0, 0.0, 9)
    assert pool.n == 1
