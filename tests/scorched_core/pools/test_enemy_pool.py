import dataclasses
import math
import random
from array import array
from types import SimpleNamespace

import pytest

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.events.event_ring import EventRing
from scorched_core.paths.path_spec import PathSpec
from scorched_core.patterns.fire_pattern import FirePattern
from scorched_core.patterns.pattern_library import PATTERN_TABLE, pattern_index
from scorched_core.patterns.pattern_spec import PatternSpec
from scorched_core.pools import enemy_pool
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import (
    BLAST_LARGE,
    BLAST_MEDIUM,
    BLAST_SMALL,
    ENEMY_CAP,
    ENEMY_STRIDE,
    EV_ENEMY_FIRE,
    EV_EXPLOSION,
    EV_HIT,
    EVENT_SOFT_CAP,
    EVENT_STRIDE,
    PLAYFIELD_H,
    PLAYFIELD_W,
)
from scorched_core.tuning import (
    ENEMY_EXIT_MARGIN,
    ENEMY_FIRE_DELAY,
    ENEMY_FIRE_MAX_Y,
    ENEMY_FLASH_TICKS,
    ENEMY_HP,
    ENEMY_MAX_ALIVE,
    ENEMY_RADIUS,
    ENEMY_SWAY,
    ENEMY_SWAY_PERIOD,
    GROUND_SCROLL_RATIO,
    HOVER_DRIFT,
    HOVER_DRIFT_PERIOD,
    HOVER_EXIT_SPEED,
    HOVER_HOLD_TICKS,
    HOVER_STOP_Y,
    SCROLL_SPEED,
)

SHIP_X = 120.0
SHIP_Y = 272.0


def jet(pool: EnemyPool, x: float = 120.0, y: float = 100.0, vy: float = 0.9) -> int:
    assert pool.spawn(EnemyKind.JET, x, y, MotionKind.SWAY, 0.0, vy)
    return pool.n - 1


def test_spawn_fills_the_kind_row_with_a_fresh_uid() -> None:
    pool = EnemyPool()
    assert pool.spawn(EnemyKind.JET, 120.0, -12.0, MotionKind.SWAY, 0.0, 0.9)
    assert pool.n == 1
    assert (pool.x[0], pool.y[0], pool.base_x[0]) == (120.0, -12.0, 120.0)
    assert (pool.kind[0], pool.radius[0], pool.hp[0]) == (EnemyKind.JET, 9.0, 3)
    assert (pool.flash[0], pool.age[0], pool.drop[0], pool.uid[0]) == (0, 0, -1, 1)


def test_each_kind_takes_its_radius_and_hp_from_the_tables() -> None:
    pool = EnemyPool()
    for kind in EnemyKind:
        pool.spawn(kind, 100.0, 50.0, MotionKind.SWAY, 0.0, 0.0, drop=int(kind))
    assert [pool.radius[i] for i in range(pool.n)] == list(ENEMY_RADIUS)
    assert [pool.hp[i] for i in range(pool.n)] == list(ENEMY_HP)
    assert [pool.drop[i] for i in range(pool.n)] == list(range(len(EnemyKind)))


def test_uids_strictly_increase_and_are_never_reused_after_removal() -> None:
    pool = EnemyPool()
    jet(pool)
    jet(pool)
    pool.hp[0] = 0
    pool.remove_dead(EventRing())
    jet(pool)
    assert sorted(pool.uid[i] for i in range(pool.n)) == [2, 3]


def test_the_forty_first_live_spawn_is_refused() -> None:
    pool = EnemyPool()
    for _ in range(ENEMY_MAX_ALIVE):
        assert pool.spawn(EnemyKind.JET, 100.0, 0.0, MotionKind.SWAY, 0.0, 0.0)
    assert not pool.spawn(EnemyKind.JET, 100.0, 0.0, MotionKind.SWAY, 0.0, 0.0)
    assert pool.n == ENEMY_MAX_ALIVE < ENEMY_CAP


def test_a_step_moves_down_and_follows_the_sine_sway() -> None:
    pool = EnemyPool()
    jet(pool, y=0.0)
    for k in range(1, 61):
        pool.step(SHIP_X, SHIP_Y)
        expected = 120.0 + ENEMY_SWAY * math.sin(k * math.tau / ENEMY_SWAY_PERIOD)
        assert pool.x[0] == pytest.approx(expected, abs=2e-3), k
    assert pool.y[0] == pytest.approx(60 * 0.9, abs=1e-3)
    assert pool.age[0] == 60


def test_vx_drifts_the_sway_centre() -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.JET, 100.0, 0.0, MotionKind.SWAY, 0.5, 0.0)
    for _ in range(ENEMY_SWAY_PERIOD):
        pool.step(SHIP_X, SHIP_Y)
    assert pool.x[0] == pytest.approx(100.0 + 0.5 * ENEMY_SWAY_PERIOD, abs=1e-2)


def test_the_angle_is_the_heading_of_the_steps_displacement() -> None:
    pool = EnemyPool()
    jet(pool, y=0.0, vy=1.0)
    previous = pool.x[0]
    pool.step(SHIP_X, SHIP_Y)
    assert pool.angle[0] == pytest.approx(math.atan2(pool.x[0] - previous, 1.0), abs=1e-5)
    assert pool.angle[0] > 0.0  # the first sway step swings right


def test_flash_decays_by_one_per_step_to_zero() -> None:
    pool = EnemyPool()
    jet(pool)
    pool.apply_hit(0, 1, EventRing())
    seen = []
    for _ in range(ENEMY_FLASH_TICKS + 2):
        pool.step(SHIP_X, SHIP_Y)
        seen.append(pool.flash[0])
    assert seen == [3, 2, 1, 0, 0, 0]


def test_an_enemy_below_the_exit_line_leaves_without_a_kill_or_event() -> None:
    ring = EventRing()
    pool = EnemyPool()
    jet(pool, y=PLAYFIELD_H + ENEMY_EXIT_MARGIN)
    pool.step(SHIP_X, SHIP_Y)
    pool.remove_dead(ring)
    assert pool.n == 0
    assert pool.kills == 0
    assert ring.n == 0


def test_an_enemy_just_inside_the_exit_line_stays() -> None:
    pool = EnemyPool()
    jet(pool, y=PLAYFIELD_H + ENEMY_EXIT_MARGIN - 1.0)
    pool.step(SHIP_X, SHIP_Y)
    assert pool.n == 1


@pytest.mark.parametrize(
    "x", [-2 * ENEMY_EXIT_MARGIN - 5.0, PLAYFIELD_W + 2 * ENEMY_EXIT_MARGIN + 5.0]
)
def test_an_enemy_far_outside_either_side_leaves(x: float) -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.JET, x, 100.0, MotionKind.SWAY, 0.0, 0.0)
    pool.step(SHIP_X, SHIP_Y)
    assert pool.n == 0
    assert pool.kills == 0


def test_a_leaver_swap_removal_keeps_the_other_enemies_stepping() -> None:
    pool = EnemyPool()
    jet(pool, y=PLAYFIELD_H + ENEMY_EXIT_MARGIN)
    jet(pool, x=60.0, y=10.0)
    jet(pool, x=180.0, y=20.0)
    pool.step(SHIP_X, SHIP_Y)
    assert pool.n == 2
    assert sorted(round(pool.y[i], 1) for i in range(2)) == [10.9, 20.9]
    assert all(pool.age[i] == 1 for i in range(2))


def test_a_hit_on_a_resting_enemy_pushes_one_low_priority_hit_with_its_kind() -> None:
    ring = EventRing()
    pool = EnemyPool()
    pool.spawn(EnemyKind.HELI, 60.0, 90.0, MotionKind.SWAY, 0.0, 0.0)
    pool.apply_hit(0, 1, ring)
    assert ring.n == 1
    assert list(ring.buf[:EVENT_STRIDE]) == [EV_HIT, 60.0, 90.0, float(EnemyKind.HELI), 0.0, 0.0]
    assert pool.hp[0] == ENEMY_HP[EnemyKind.HELI] - 1
    assert pool.flash[0] == ENEMY_FLASH_TICKS


def test_hits_while_flashing_push_no_extra_event() -> None:
    ring = EventRing()
    pool = EnemyPool()
    jet(pool)
    pool.apply_hit(0, 1, ring)
    pool.apply_hit(0, 1, ring)
    assert ring.n == 1
    assert pool.hp[0] == 1


def test_a_finished_flash_allows_a_fresh_hit_event() -> None:
    ring = EventRing()
    pool = EnemyPool()
    pool.spawn(EnemyKind.HELI, 60.0, 90.0, MotionKind.SWAY, 0.0, 0.0)
    pool.apply_hit(0, 1, ring)
    pool.flash[0] = 0
    pool.apply_hit(0, 1, ring)
    assert ring.n == 2


def test_the_damage_argument_is_subtracted() -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.CARRIER, 60.0, 90.0, MotionKind.SWAY, 0.0, 0.0)
    pool.apply_hit(0, 5, EventRing())
    assert pool.hp[0] == ENEMY_HP[EnemyKind.CARRIER] - 5


def test_a_killing_blow_on_a_resting_enemy_pushes_no_hit() -> None:
    ring = EventRing()
    pool = EnemyPool()
    jet(pool)
    pool.hp[0] = 1
    pool.apply_hit(0, 1, ring)
    assert ring.n == 0


@pytest.mark.parametrize(
    ("kind", "blast", "ground"),
    [
        (EnemyKind.JET, BLAST_SMALL, 0.0),
        (EnemyKind.HELI, BLAST_MEDIUM, 0.0),
        (EnemyKind.CARRIER, BLAST_MEDIUM, 0.0),
        (EnemyKind.TANK, BLAST_LARGE, 1.0),
        (EnemyKind.TURRET, BLAST_MEDIUM, 1.0),
    ],
)
def test_a_kill_pushes_one_explosion_with_its_class_ground_flag_and_kind(
    kind: EnemyKind, blast: int, ground: float
) -> None:
    ring = EventRing()
    pool = EnemyPool()
    pool.spawn(kind, 60.0, 90.0, MotionKind.SWAY, 0.0, 0.0)
    pool.hp[0] = 0
    pool.remove_dead(ring)
    assert list(ring.buf[:EVENT_STRIDE]) == [EV_EXPLOSION, 60.0, 90.0, blast, ground, float(kind)]
    assert (pool.n, pool.kills) == (0, 1)


def test_the_kill_buffer_records_position_kind_and_drop_and_resets_each_call() -> None:
    ring = EventRing()
    pool = EnemyPool()
    pool.spawn(EnemyKind.TANK, 30.0, 40.0, MotionKind.SWAY, 0.0, 0.0, drop=2)
    pool.spawn(EnemyKind.JET, 50.0, 60.0, MotionKind.SWAY, 0.0, 0.0)
    pool.spawn(EnemyKind.HELI, 70.0, 80.0, MotionKind.SWAY, 0.0, 0.0, drop=1)
    for i in (0, 2):
        pool.hp[i] = 0
    pool.remove_dead(ring)
    assert pool.kill_n == 2
    kills = {
        (pool.kill_x[k], pool.kill_y[k], pool.kill_kind[k], pool.kill_drop[k]) for k in range(2)
    }
    assert kills == {(30.0, 40.0, EnemyKind.TANK, 2), (70.0, 80.0, EnemyKind.HELI, 1)}
    assert pool.n == 1
    pool.remove_dead(ring)
    assert pool.kill_n == 0
    assert pool.kills == 2


def test_remove_dead_swap_removes_and_keeps_the_survivors_intact() -> None:
    pool = EnemyPool()
    for x in (10.0, 20.0, 30.0):
        jet(pool, x=x)
    pool.hp[1] = 0
    pool.remove_dead(EventRing())
    assert sorted(pool.x[i] for i in range(pool.n)) == [10.0, 30.0]
    assert sorted(pool.uid[i] for i in range(pool.n)) == [1, 3]


def test_pack_writes_stride_eight_with_normalised_flash_and_hp() -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.HELI, 60.0, 90.0, MotionKind.SWAY, 0.0, 0.0)
    pool.apply_hit(0, 2, EventRing())
    pool.angle[0] = 0.25
    pool.aux[0] = 7.0
    out = array("f", [9.0]) * (ENEMY_STRIDE * ENEMY_CAP)
    pool.pack_into(out)
    assert list(out[:ENEMY_STRIDE]) == [
        60.0,
        90.0,
        0.25,
        1.0,
        pytest.approx(4 / 6),
        float(EnemyKind.HELI),
        7.0,
        0.0,
    ]
    assert out[ENEMY_STRIDE] == 9.0  # beyond the live enemies is untouched


def test_pack_with_no_enemies_writes_nothing() -> None:
    out = array("f", [7.0]) * (ENEMY_STRIDE * ENEMY_CAP)
    EnemyPool().pack_into(out)
    assert set(out) == {7.0}


def test_overkill_in_one_step_still_yields_one_explosion_and_one_kill() -> None:
    ring = EventRing()
    pool = EnemyPool()
    jet(pool)
    pool.hp[0] = 1
    pool.apply_hit(0, 1, ring)
    pool.apply_hit(0, 5, ring)  # an overkill: hp is now far below zero
    pool.remove_dead(ring)
    assert (pool.n, pool.kills, pool.kill_n) == (0, 1, 1)
    assert ring.n == 1
    assert ring.buf[0] == EV_EXPLOSION


def test_a_dead_enemy_is_removed_exactly_once_however_often_remove_dead_runs() -> None:
    ring = EventRing()
    pool = EnemyPool()
    jet(pool)
    pool.hp[0] = -4
    pool.remove_dead(ring)
    pool.remove_dead(ring)
    assert (pool.kills, ring.n) == (1, 1)


def test_uids_are_never_reissued_across_many_swap_removals() -> None:
    pool = EnemyPool()
    issued: list[int] = []
    for round_ in range(30):
        for _ in range(4):
            jet(pool, x=20.0 + round_)
            issued.append(pool.uid[pool.n - 1])
        pool.hp[0] = 0
        pool.hp[pool.n // 2] = 0
        pool.hp[pool.n - 1] = 0
        pool.remove_dead(EventRing())
        live = [pool.uid[i] for i in range(pool.n)]
        assert len(live) == len(set(live))
    assert issued == sorted(set(issued))  # strictly increasing: nothing was ever reissued


# --- HOVER ---------------------------------------------------------------------------------


def heli(pool: EnemyPool, x: float = 80.0, y: float = -14.0, vy: float = 1.2) -> int:
    assert pool.spawn(EnemyKind.HELI, x, y, MotionKind.HOVER, 0.0, vy)
    return pool.n - 1


def test_a_hover_spawn_starts_with_the_full_hold_timer_and_other_motions_with_none() -> None:
    pool = EnemyPool()
    heli(pool)
    jet(pool)
    assert (pool.motion[0], pool.timer[0]) == (MotionKind.HOVER, HOVER_HOLD_TICKS)
    assert (pool.motion[1], pool.timer[1]) == (MotionKind.SWAY, 0)


def test_hover_descends_at_its_speed_without_drifting_until_it_reaches_the_stop_line() -> None:
    pool = EnemyPool()
    heli(pool)
    for k in range(1, 11):
        pool.step(SHIP_X, SHIP_Y)
        assert pool.y[0] == pytest.approx(-14.0 + 1.2 * k, abs=1e-4)
        assert pool.x[0] == 80.0
    assert pool.timer[0] == HOVER_HOLD_TICKS


def test_hover_stops_exactly_on_the_stop_line_and_holds_for_the_hold_ticks() -> None:
    pool = EnemyPool()
    heli(pool)
    descent = math.ceil((HOVER_STOP_Y + 14.0) / 1.2)
    for _ in range(descent):
        pool.step(SHIP_X, SHIP_Y)
    assert pool.y[0] == HOVER_STOP_Y
    assert pool.timer[0] == HOVER_HOLD_TICKS
    for k in range(1, HOVER_HOLD_TICKS + 1):
        pool.step(SHIP_X, SHIP_Y)
        assert pool.y[0] == HOVER_STOP_Y, k
        assert pool.timer[0] == HOVER_HOLD_TICKS - k
    pool.step(SHIP_X, SHIP_Y)
    assert pool.y[0] == pytest.approx(HOVER_STOP_Y + HOVER_EXIT_SPEED, abs=1e-4)


def test_hover_drifts_side_to_side_on_a_sine_while_holding() -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.HELI, 120.0, HOVER_STOP_Y, MotionKind.HOVER, 0.0, 1.2)
    xs = []
    for k in range(1, HOVER_DRIFT_PERIOD + 1):
        pool.step(SHIP_X, SHIP_Y)
        expected = 120.0 + HOVER_DRIFT * math.sin(k * math.tau / HOVER_DRIFT_PERIOD)
        assert pool.x[0] == pytest.approx(expected, abs=2e-3), k
        xs.append(pool.x[0])
    assert max(xs) > 120.0 + HOVER_DRIFT - 1.0
    assert min(xs) < 120.0 - HOVER_DRIFT + 1.0


def test_hover_leaves_downward_after_the_hold_and_is_culled_at_the_exit_line() -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.HELI, 120.0, HOVER_STOP_Y, MotionKind.HOVER, 0.0, 1.2)
    for _ in range(HOVER_HOLD_TICKS):
        pool.step(SHIP_X, SHIP_Y)
    held_x = pool.x[0]
    leave_steps = math.ceil((PLAYFIELD_H + ENEMY_EXIT_MARGIN - HOVER_STOP_Y) / HOVER_EXIT_SPEED)
    for _ in range(leave_steps - 1):
        pool.step(SHIP_X, SHIP_Y)
        assert pool.x[0] == held_x  # the drift is frozen on the way out
    assert pool.n == 1
    pool.step(SHIP_X, SHIP_Y)
    assert pool.n == 0
    assert pool.kills == 0


def test_a_hover_helicopter_keeps_facing_the_player_at_angle_zero() -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.HELI, 120.0, HOVER_STOP_Y - 3.0, MotionKind.HOVER, 0.0, 1.2)
    for _ in range(HOVER_HOLD_TICKS // 2):
        pool.step(SHIP_X, SHIP_Y)
        assert pool.angle[0] == 0.0


def test_hover_vx_carries_the_drift_centre() -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.HELI, 100.0, HOVER_STOP_Y, MotionKind.HOVER, 0.25, 1.2)
    for _ in range(HOVER_DRIFT_PERIOD):
        pool.step(SHIP_X, SHIP_Y)
    assert pool.x[0] == pytest.approx(100.0 + 0.25 * HOVER_DRIFT_PERIOD, abs=1e-2)


def test_a_hover_helicopter_spawned_below_the_stop_line_holds_at_once() -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.HELI, 120.0, HOVER_STOP_Y + 20.0, MotionKind.HOVER, 0.0, 1.2)
    pool.step(SHIP_X, SHIP_Y)
    assert pool.y[0] == HOVER_STOP_Y + 20.0
    assert pool.timer[0] == HOVER_HOLD_TICKS - 1


def test_removal_moves_the_motion_and_timer_with_the_swapped_enemy() -> None:
    pool = EnemyPool()
    jet(pool)
    heli(pool)
    pool.step(SHIP_X, SHIP_Y)
    pool.hp[0] = 0
    pool.remove_dead(EventRing())
    assert pool.n == 1
    assert (pool.kind[0], pool.motion[0]) == (EnemyKind.HELI, MotionKind.HOVER)
    assert pool.timer[0] == HOVER_HOLD_TICKS


def test_killing_a_hover_helicopter_pushes_a_medium_air_explosion() -> None:
    ring = EventRing()
    pool = EnemyPool()
    pool.spawn(EnemyKind.HELI, 120.0, HOVER_STOP_Y, MotionKind.HOVER, 0.0, 1.2)
    for _ in range(30):
        pool.step(SHIP_X, SHIP_Y)
    pool.hp[0] = 0
    pool.remove_dead(ring)
    assert ring.buf[0] == EV_EXPLOSION
    assert (ring.buf[3], ring.buf[4], ring.buf[5]) == (BLAST_MEDIUM, 0.0, float(EnemyKind.HELI))


# --- DIVE ----------------------------------------------------------------------------------


def dive(pool: EnemyPool, x: float, y: float, vx: float, vy: float) -> int:
    assert pool.spawn(EnemyKind.JET, x, y, MotionKind.DIVE, vx, vy)
    return pool.n - 1


def test_dive_flies_a_straight_line_at_its_velocity() -> None:
    pool = EnemyPool()
    dive(pool, 60.0, -12.0, 0.5, 2.2)
    for k in range(1, 41):
        pool.step(SHIP_X, SHIP_Y)
        assert pool.x[0] == pytest.approx(60.0 + 0.5 * k, abs=1e-3)
        assert pool.y[0] == pytest.approx(-12.0 + 2.2 * k, abs=1e-3)


def test_dive_faces_its_heading() -> None:
    pool = EnemyPool()
    dive(pool, 60.0, -12.0, 2.4, 0.9)
    pool.step(SHIP_X, SHIP_Y)
    assert pool.angle[0] == pytest.approx(math.atan2(2.4, 0.9), abs=1e-5)
    dive(pool, 120.0, -12.0, 0.0, 2.4)
    pool.step(SHIP_X, SHIP_Y)
    assert pool.angle[1] == 0.0


def test_a_dive_jet_crossing_the_field_leaves_on_the_far_side_without_a_kill_or_event() -> None:
    ring = EventRing()
    pool = EnemyPool()
    dive(pool, -12.0, 60.0, 2.4, 0.9)
    for _ in range(200):
        pool.step(SHIP_X, SHIP_Y)
        pool.remove_dead(ring)
        if pool.n == 0:
            break
    assert pool.n == 0
    assert pool.kills == 0
    assert ring.n == 0


def test_a_dive_jet_is_still_inside_while_it_crosses_the_middle_of_the_field() -> None:
    pool = EnemyPool()
    dive(pool, -12.0, 60.0, 2.4, 0.9)
    for _ in range(50):
        pool.step(SHIP_X, SHIP_Y)
    assert pool.n == 1
    assert 90.0 < pool.x[0] < 120.0


# --- GROUND and aim -----------------------------------------------------------------------


def tank(
    pool: EnemyPool, x: float = 100.0, y: float = -16.0, vx: float = 0.0, vy: float = 0.0
) -> int:
    assert pool.spawn(EnemyKind.TANK, x, y, MotionKind.GROUND, vx, vy)
    return pool.n - 1


def test_ground_without_a_crawl_moves_exactly_the_scaled_scroll_speed_per_step() -> None:
    pool = EnemyPool()
    tank(pool)
    pool.step(SHIP_X, SHIP_Y)
    assert pool.y[0] == pytest.approx(-16.0 + 0.752, abs=1e-5)
    assert pool.x[0] == 100.0
    for _ in range(99):
        pool.step(SHIP_X, SHIP_Y)
    assert pool.y[0] == pytest.approx(-16.0 + 100 * 0.752, abs=1e-3)


def test_ground_scroll_speed_is_the_terrain_scroll_times_the_exported_ratio() -> None:
    assert SCROLL_SPEED * GROUND_SCROLL_RATIO == pytest.approx(0.752)  # noqa: SIM300


def test_ground_moves_by_the_ground_scroll_it_is_given() -> None:
    pool = EnemyPool()
    tank(pool)
    pool.step(SHIP_X, SHIP_Y, 0.1)
    assert pool.y[0] == pytest.approx(-16.0 + 0.1, abs=1e-5)
    pool.step(SHIP_X, SHIP_Y, 0.0)
    assert pool.y[0] == pytest.approx(-16.0 + 0.1, abs=1e-5)  # a stopped terrain holds it still


def test_ground_scroll_adds_to_the_units_own_crawl() -> None:
    pool = EnemyPool()
    tank(pool, vy=0.3)
    pool.step(SHIP_X, SHIP_Y, 0.1)
    assert pool.y[0] == pytest.approx(-16.0 + 0.4, abs=1e-5)


def test_ground_scroll_does_not_move_air_units() -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.JET, 100.0, 50.0, MotionKind.DIVE, 0.0, 2.0)
    pool.step(SHIP_X, SHIP_Y, 5.0)
    assert pool.y[0] == pytest.approx(52.0)


def test_ground_adds_its_own_crawl_to_the_scroll() -> None:
    pool = EnemyPool()
    tank(pool, vx=0.25, vy=0.1)
    for _ in range(40):
        pool.step(SHIP_X, SHIP_Y)
    assert pool.x[0] == pytest.approx(100.0 + 0.25 * 40, abs=1e-3)
    assert pool.y[0] == pytest.approx(-16.0 + (0.752 + 0.1) * 40, abs=1e-3)


def test_ground_angle_is_the_heading_of_its_own_crawl_and_zero_when_it_does_not_crawl() -> None:
    pool = EnemyPool()
    tank(pool, vx=0.25, vy=0.5)
    tank(pool)
    pool.step(SHIP_X, SHIP_Y)
    assert pool.angle[0] == pytest.approx(math.atan2(0.25, 0.5), abs=1e-5)
    assert pool.angle[1] == 0.0


def test_a_ground_unit_is_culled_below_the_exit_line_without_a_kill_or_event() -> None:
    ring = EventRing()
    pool = EnemyPool()
    tank(pool, y=PLAYFIELD_H + ENEMY_EXIT_MARGIN - 0.5)
    pool.step(SHIP_X, SHIP_Y)
    pool.remove_dead(ring)
    assert (pool.n, pool.kills, ring.n) == (0, 0, 0)


@pytest.mark.parametrize("kind", [EnemyKind.TANK, EnemyKind.TURRET])
def test_aim_points_a_tank_or_turret_at_the_ship(kind: EnemyKind) -> None:
    pool = EnemyPool()
    pool.spawn(kind, 60.0, 100.0, MotionKind.GROUND, 0.0, 0.0)
    pool.step(180.0, 300.0)
    expected = math.atan2(180.0 - 60.0, 300.0 - (100.0 + 0.752))
    assert pool.aux[0] == pytest.approx(expected, abs=1e-5)
    assert 0.0 < pool.aux[0] < math.pi / 2


def test_aim_is_zero_when_the_ship_is_straight_below_and_negative_to_the_left() -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.TURRET, 120.0, 100.0, MotionKind.GROUND, 0.0, 0.0)
    pool.step(120.0, 300.0)
    assert pool.aux[0] == 0.0
    pool.step(20.0, 300.0)
    assert pool.aux[0] < 0.0


def test_aim_is_packed_into_the_aux_slot() -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.TURRET, 60.0, 100.0, MotionKind.GROUND, 0.0, 0.0)
    pool.step(180.0, 300.0)
    out = array("f", bytes(4 * ENEMY_STRIDE * ENEMY_CAP))
    pool.pack_into(out)
    assert out[6] == pool.aux[0]
    assert out[6] != 0.0


@pytest.mark.parametrize("kind", [EnemyKind.JET, EnemyKind.HELI, EnemyKind.CARRIER])
def test_other_kinds_keep_aux_zero(kind: EnemyKind) -> None:
    pool = EnemyPool()
    pool.spawn(kind, 60.0, 100.0, MotionKind.SWAY, 0.0, 0.5)
    pool.step(180.0, 300.0)
    assert pool.aux[0] == 0.0


def test_killing_a_tank_pushes_a_large_ground_explosion() -> None:
    ring = EventRing()
    pool = EnemyPool()
    tank(pool, y=40.0)
    pool.step(SHIP_X, SHIP_Y)
    pool.hp[0] = 0
    pool.remove_dead(ring)
    assert ring.buf[0] == EV_EXPLOSION
    assert (ring.buf[3], ring.buf[4], ring.buf[5]) == (BLAST_LARGE, 1.0, float(EnemyKind.TANK))


def test_a_corrupt_motion_value_fails_loudly_instead_of_standing_still() -> None:
    pool = EnemyPool()
    jet(pool)
    pool.motion[0] = 99
    with pytest.raises(ValueError, match="unknown motion 99"):
        pool.step(SHIP_X, SHIP_Y)


def test_index_of_uid_returns_the_live_slot_of_an_enemy() -> None:
    pool = EnemyPool()
    for x in (10.0, 20.0, 30.0):
        jet(pool, x=x)
    assert [pool.index_of_uid(int(pool.uid[i])) for i in range(3)] == [0, 1, 2]


def test_index_of_uid_follows_an_enemy_through_a_swap_remove() -> None:
    pool = EnemyPool()
    for x in (10.0, 20.0, 30.0):
        jet(pool, x=x)
    last_uid = int(pool.uid[2])
    pool.hp[0] = 0
    pool.remove_dead(EventRing())
    assert pool.index_of_uid(last_uid) == 0  # the last enemy took the freed slot
    assert pool.index_of_uid(1) == -1  # the removed enemy's uid is gone for good


def test_index_of_uid_is_minus_one_for_an_unknown_uid_and_ignores_dead_slots() -> None:
    pool = EnemyPool()
    jet(pool)
    assert pool.index_of_uid(0) == -1
    assert pool.index_of_uid(999) == -1
    pool.uid[5] = 42  # a stale value past the live count is never found
    assert pool.index_of_uid(42) == -1


def shooter(pool: EnemyPool, kind: EnemyKind, y: float = 100.0, x: float = 120.0) -> int:
    assert pool.spawn(kind, x, y, MotionKind.GROUND, 0.0, 0.0)
    return pool.n - 1


def test_spawn_arms_the_fire_timer_with_the_spawn_delay() -> None:
    pool = EnemyPool()
    shooter(pool, EnemyKind.TURRET)
    assert pool.fire_timer[0] == ENEMY_FIRE_DELAY == 45


def test_a_turret_fires_its_first_shot_after_delay_then_every_interval() -> None:
    pool, bullets, ring = EnemyPool(), BulletPool(50), EventRing()
    shooter(pool, EnemyKind.TURRET)
    fired_on = [call for call in range(1, 300) if pool.fire(bullets, SHIP_X, SHIP_Y, ring) == 1]
    assert fired_on == [45, 135, 225]
    assert bullets.n == 3


def test_a_firing_turret_pushes_one_low_enemy_fire_event_per_volley() -> None:
    pool, bullets, ring = EnemyPool(), BulletPool(50), EventRing()
    shooter(pool, EnemyKind.TURRET, y=120.0, x=60.0)
    for _ in range(ENEMY_FIRE_DELAY):
        pool.fire(bullets, SHIP_X, SHIP_Y, ring)
    assert ring.n == 1
    assert [float(v) for v in ring.buf[:EVENT_STRIDE]] == [
        EV_ENEMY_FIRE,
        60.0,
        120.0,
        1.0,
        0.0,
        0.0,
    ]


def test_the_enemy_fire_event_is_low_priority() -> None:
    pool, bullets, ring = EnemyPool(), BulletPool(50), EventRing()
    shooter(pool, EnemyKind.TURRET)
    ring.n = EVENT_SOFT_CAP
    for _ in range(ENEMY_FIRE_DELAY):
        pool.fire(bullets, SHIP_X, SHIP_Y, ring)
    assert bullets.n == 1  # the shot flew
    assert ring.n == EVENT_SOFT_CAP  # the low event was refused
    assert ring.dropped == 1


def test_an_aimed_shot_leaves_the_muzzle_towards_the_ship_at_the_kind_speed() -> None:
    pool, bullets, ring = EnemyPool(), BulletPool(50), EventRing()
    shooter(pool, EnemyKind.TANK, y=200.0, x=SHIP_X)
    for _ in range(ENEMY_FIRE_DELAY):
        pool.fire(bullets, SHIP_X, 100.0, ring)  # the ship is straight above the tank
    assert (bullets.vx[0], bullets.vy[0]) == pytest.approx((0.0, -1.6))
    assert (bullets.x[0], bullets.y[0]) == (SHIP_X, 200.0)


def test_each_aimed_kind_shoots_at_its_own_interval_and_speed() -> None:
    for kind, interval, speed in (
        (EnemyKind.JET, 140, 2.0),
        (EnemyKind.TANK, 120, 1.6),
        (EnemyKind.TURRET, 90, 1.8),
    ):
        pool, bullets, ring = EnemyPool(), BulletPool(50), EventRing()
        shooter(pool, kind, y=100.0, x=SHIP_X)
        for _ in range(ENEMY_FIRE_DELAY):
            pool.fire(bullets, SHIP_X, SHIP_Y, ring)
        assert bullets.n == 1
        assert math.hypot(bullets.vx[0], bullets.vy[0]) == pytest.approx(speed)
        assert pool.fire_timer[0] == interval


def test_a_carrier_never_fires() -> None:
    pool, bullets, ring = EnemyPool(), BulletPool(50), EventRing()
    shooter(pool, EnemyKind.CARRIER)
    assert sum(pool.fire(bullets, SHIP_X, SHIP_Y, ring) for _ in range(1000)) == 0
    assert bullets.n == 0
    assert ring.n == 0


def test_a_volley_into_a_full_pool_spawns_nothing_and_pushes_no_event() -> None:
    pool, bullets, ring = EnemyPool(), BulletPool(1), EventRing()
    bullets.spawn(0.0, 0.0, 0.0, 0.0)
    shooter(pool, EnemyKind.TURRET)
    assert sum(pool.fire(bullets, SHIP_X, SHIP_Y, ring) for _ in range(ENEMY_FIRE_DELAY)) == 0
    assert ring.n == 0
    assert pool.fire_timer[0] == 90  # the volley still counted: the interval reloaded


def test_the_fire_timer_follows_its_enemy_through_a_swap_remove() -> None:
    pool, bullets, ring = EnemyPool(), BulletPool(50), EventRing()
    shooter(pool, EnemyKind.CARRIER)
    shooter(pool, EnemyKind.TURRET)
    for _ in range(10):
        pool.fire(bullets, SHIP_X, SHIP_Y, ring)
    pool._remove_at(0)
    assert pool.kind[0] == EnemyKind.TURRET
    assert pool.fire_timer[0] == ENEMY_FIRE_DELAY - 10


def test_a_corrupt_fire_pattern_fails_loudly_instead_of_standing_silent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bogus = SimpleNamespace(shape=99, delay=ENEMY_FIRE_DELAY, interval=10, burst=1, burst_gap=1)
    monkeypatch.setattr(enemy_pool, "PATTERN_TABLE", (bogus,))
    pool, bullets, ring = EnemyPool(), BulletPool(50), EventRing()
    assert pool.spawn(EnemyKind.TURRET, 120.0, 100.0, MotionKind.GROUND, 0.0, 0.0, pattern=0)
    pool.fire_timer[0] = 1
    with pytest.raises(ValueError, match="unknown pattern shape 99"):
        pool.fire(bullets, SHIP_X, SHIP_Y, ring)


def test_a_helicopter_fires_a_ring_of_eight_at_its_speed_after_the_delay() -> None:
    pool, bullets, ring = EnemyPool(), BulletPool(50), EventRing()
    shooter(pool, EnemyKind.HELI)
    assert sum(pool.fire(bullets, SHIP_X, SHIP_Y, ring) for _ in range(ENEMY_FIRE_DELAY)) == 8
    assert bullets.n == 8
    assert all(
        math.hypot(bullets.vx[k], bullets.vy[k]) == pytest.approx(1.3) for k in range(bullets.n)
    )
    assert pool.fire_timer[0] == 150
    assert ring.n == 1
    assert (ring.buf[0], ring.buf[3]) == (EV_ENEMY_FIRE, float(FirePattern.RING))


def test_consecutive_rings_are_rotated_by_half_a_step_so_they_interleave() -> None:
    pool, bullets, ring = EnemyPool(), BulletPool(50), EventRing()
    shooter(pool, EnemyKind.HELI)
    for _ in range(3):
        pool.fire_timer[0] = 1
        pool.fire(bullets, SHIP_X, SHIP_Y, ring)
    assert bullets.n == 24
    assert bullets.angle[0] == pytest.approx(0.0)
    assert bullets.angle[8] == pytest.approx(math.pi / 8)
    assert bullets.angle[16] == pytest.approx(0.0)


def test_a_helicopter_ring_into_a_nearly_full_pool_spawns_what_fits() -> None:
    pool, bullets, ring = EnemyPool(), BulletPool(5), EventRing()
    shooter(pool, EnemyKind.HELI)
    pool.fire_timer[0] = 1
    assert pool.fire(bullets, SHIP_X, SHIP_Y, ring) == 5
    assert ring.n == 1


def test_an_enemy_above_the_top_edge_holds_fire_while_its_timer_keeps_running() -> None:
    pool, bullets, ring = EnemyPool(), BulletPool(50), EventRing()
    shooter(pool, EnemyKind.TURRET, y=-0.5)
    assert sum(pool.fire(bullets, SHIP_X, SHIP_Y, ring) for _ in range(300)) == 0
    assert pool.fire_timer[0] == 0  # the delay ran out while it was held
    pool.y[0] = 0.0
    assert pool.fire(bullets, SHIP_X, SHIP_Y, ring) == 1  # the held shot goes the moment it is in


def test_an_enemy_below_the_fire_band_holds_fire() -> None:
    pool, bullets, ring = EnemyPool(), BulletPool(50), EventRing()
    shooter(pool, EnemyKind.TANK, y=ENEMY_FIRE_MAX_Y + 0.5)
    assert sum(pool.fire(bullets, SHIP_X, SHIP_Y, ring) for _ in range(300)) == 0
    assert ring.n == 0
    pool.y[0] = ENEMY_FIRE_MAX_Y
    assert pool.fire(bullets, SHIP_X, SHIP_Y, ring) == 1  # the edge of the band still fires


def test_the_fire_band_is_the_top_seventy_percent_of_the_playfield() -> None:
    assert pytest.approx(PLAYFIELD_H * 0.7) == ENEMY_FIRE_MAX_Y


def _spec(name: str) -> PatternSpec:
    return PATTERN_TABLE[pattern_index(name)]


def test_spawn_takes_the_kind_default_pattern_when_none_is_given() -> None:
    pool = EnemyPool()
    for kind, name in (
        (EnemyKind.JET, "jet_aimed"),
        (EnemyKind.HELI, "heli_ring"),
        (EnemyKind.TANK, "tank_aimed"),
        (EnemyKind.TURRET, "turret_aimed"),
    ):
        assert pool.spawn(kind, 120.0, 100.0, MotionKind.GROUND, 0.0, 0.0)
        assert pool.pattern[pool.n - 1] == pattern_index(name)


def test_a_carrier_defaults_to_no_pattern() -> None:
    pool = EnemyPool()
    shooter(pool, EnemyKind.CARRIER)
    assert pool.pattern[0] == -1
    assert pool.fire_timer[0] == ENEMY_FIRE_DELAY


def test_spawn_with_pattern_minus_one_never_fires() -> None:
    pool, bullets, ring = EnemyPool(), BulletPool(50), EventRing()
    assert pool.spawn(EnemyKind.TURRET, 120.0, 100.0, MotionKind.GROUND, 0.0, 0.0, pattern=-1)
    assert sum(pool.fire(bullets, SHIP_X, SHIP_Y, ring) for _ in range(500)) == 0
    assert (bullets.n, ring.n) == (0, 0)


def test_spawn_with_a_pattern_index_fires_that_pattern_and_arms_its_delay() -> None:
    pool, bullets, ring = EnemyPool(), BulletPool(50), EventRing()
    index = pattern_index("spread3")
    assert pool.spawn(EnemyKind.CARRIER, 120.0, 100.0, MotionKind.GROUND, 0.0, 0.0, pattern=index)
    assert pool.pattern[0] == index
    assert pool.fire_timer[0] == _spec("spread3").delay
    fired = sum(pool.fire(bullets, SHIP_X, SHIP_Y, ring) for _ in range(_spec("spread3").delay))
    assert fired == 3
    assert (ring.buf[0], ring.buf[3]) == (EV_ENEMY_FIRE, float(FirePattern.SPREAD))
    assert pool.fire_timer[0] == _spec("spread3").interval


def test_a_fresh_enemy_has_volley_and_burst_counters_at_zero() -> None:
    pool = EnemyPool()
    pool.volley[0] = 5
    pool.burst_left[0] = 2
    shooter(pool, EnemyKind.TURRET)
    assert (pool.volley[0], pool.burst_left[0]) == (0, 0)


def test_each_volley_advances_the_row_volley_counter() -> None:
    pool, bullets, ring = EnemyPool(), BulletPool(50), EventRing()
    shooter(pool, EnemyKind.TURRET)
    for expected in (1, 2, 3):
        pool.fire_timer[0] = 1
        pool.fire(bullets, SHIP_X, SHIP_Y, ring)
        assert pool.volley[0] == expected


def test_a_stream_fires_its_burst_a_gap_apart_then_waits_the_interval() -> None:
    pool, bullets, ring = EnemyPool(), BulletPool(50), EventRing()
    assert pool.spawn(
        EnemyKind.TURRET,
        120.0,
        100.0,
        MotionKind.GROUND,
        0.0,
        0.0,
        pattern=pattern_index("stream3"),
    )
    spec = _spec("stream3")
    assert (spec.burst, spec.burst_gap) == (3, 8)
    total = spec.delay + spec.burst_gap * 2 + spec.interval + 1
    fired_on = [call for call in range(1, total) if pool.fire(bullets, SHIP_X, SHIP_Y, ring) == 1]
    first = spec.delay
    assert fired_on == [first, first + 8, first + 16, first + 16 + spec.interval]
    assert pool.burst_left[0] == 2  # the next burst has started


def test_a_burst_reloads_the_gap_while_it_lasts_and_the_interval_when_it_ends() -> None:
    pool, bullets, ring = EnemyPool(), BulletPool(50), EventRing()
    assert pool.spawn(
        EnemyKind.TURRET,
        120.0,
        100.0,
        MotionKind.GROUND,
        0.0,
        0.0,
        pattern=pattern_index("stream3"),
    )
    spec = _spec("stream3")
    timers = []
    for _ in range(3):
        pool.fire_timer[0] = 1
        pool.fire(bullets, SHIP_X, SHIP_Y, ring)
        timers.append((int(pool.fire_timer[0]), int(pool.burst_left[0])))
    assert timers == [(spec.burst_gap, 2), (spec.burst_gap, 1), (spec.interval, 0)]


def test_columns_cover_every_array_field_except_the_kill_buffer() -> None:
    pool = EnemyPool()
    arrays = {f.name for f in dataclasses.fields(pool) if isinstance(getattr(pool, f.name), array)}
    kill_buffer = {"kill_x", "kill_y", "kill_kind", "kill_drop"}
    assert set(enemy_pool._COLUMNS) == arrays - kill_buffer
    assert len(enemy_pool._COLUMNS) == len(set(enemy_pool._COLUMNS))
    assert {"pattern", "volley", "burst_left", "fire_timer"} <= set(enemy_pool._COLUMNS)
    assert {"path", "seg", "seg_t", "base_y", "flip"} <= set(enemy_pool._COLUMNS)
    assert {"hp_max", "shield"} <= set(enemy_pool._COLUMNS)


def test_a_randomized_spawn_and_remove_sequence_keeps_every_column_in_step() -> None:
    rng = random.Random(7)  # noqa: S311 - seeded test sequence, not security
    pool = EnemyPool()
    model: list[dict[str, float]] = []
    for step in range(400):
        if model and rng.random() < 0.45:
            i = rng.randrange(len(model))
            pool._remove_at(i)
            model[i] = model[-1]
            model.pop()
        else:
            kind = rng.choice(list(EnemyKind))
            if pool.spawn(kind, float(step), 1.0, MotionKind.SWAY, 0.0, 1.0, drop=step % 3 - 1):
                i = pool.n - 1
                for name in enemy_pool._COLUMNS:  # stamp a distinct value into every column
                    getattr(pool, name)[i] = step + 1
                model.append({name: float(getattr(pool, name)[i]) for name in enemy_pool._COLUMNS})
        assert pool.n == len(model)
        for i, row in enumerate(model):
            for name in enemy_pool._COLUMNS:
                assert getattr(pool, name)[i] == row[name]


# --- PATH and SCRIPTED motion (ENMY-01, ENMY-02) ---


def use_paths(monkeypatch: pytest.MonkeyPatch, *specs: PathSpec) -> None:
    """Replace the path registry table with ``specs`` so a test controls the geometry."""
    monkeypatch.setattr(enemy_pool, "PATH_TABLE", specs)


def on_path(
    pool: EnemyPool,
    kind: EnemyKind = EnemyKind.JET,
    x: float = 100.0,
    y: float = 0.0,
    path: int = 0,
    flip: int = 1,
) -> int:
    assert pool.spawn(kind, x, y, MotionKind.PATH, 0.0, 0.0, path=path, flip=flip)
    return pool.n - 1


def test_spawn_defaults_to_no_path_and_a_forward_flip() -> None:
    pool = EnemyPool()
    jet(pool)
    assert (pool.path[0], pool.seg[0], pool.seg_t[0], pool.flip[0]) == (-1, 0, 0.0, 1)


def test_spawn_records_the_path_the_base_row_and_the_flip(monkeypatch: pytest.MonkeyPatch) -> None:
    use_paths(monkeypatch, PathSpec(((0.0, 0.0), (0.0, 50.0)), 1.0))
    pool = EnemyPool()
    on_path(pool, y=-16.0, path=0, flip=-1)
    assert (pool.path[0], pool.flip[0]) == (0, -1)
    assert (pool.seg[0], pool.seg_t[0], pool.base_y[0]) == (0, 0.0, -16.0)
    assert pool.base_x[0] == 100.0


@pytest.mark.parametrize("path", [-1, 1])
def test_spawning_a_path_motion_without_a_valid_path_is_a_loud_error(
    monkeypatch: pytest.MonkeyPatch, path: int
) -> None:
    use_paths(monkeypatch, PathSpec(((0.0, 0.0), (0.0, 50.0)), 1.0))
    with pytest.raises(ValueError, match="PATH motion needs a path index"):
        EnemyPool().spawn(EnemyKind.JET, 0.0, 0.0, MotionKind.PATH, 0.0, 0.0, path=path)


def test_a_full_pool_refuses_a_path_spawn_before_validating_the_path() -> None:
    pool = EnemyPool()
    for _ in range(ENEMY_MAX_ALIVE):
        jet(pool)
    assert not pool.spawn(EnemyKind.JET, 0.0, 0.0, MotionKind.PATH, 0.0, 0.0, path=-1)


def test_a_path_row_moves_exactly_its_speed_along_a_straight_segment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    use_paths(monkeypatch, PathSpec(((0.0, 0.0), (0.0, 400.0)), 2.0))
    pool = EnemyPool()
    on_path(pool, x=100.0, y=10.0)
    for step in range(1, 31):
        pool.step(SHIP_X, SHIP_Y)
        assert pool.x[0] == pytest.approx(100.0, abs=1e-4)
        assert pool.y[0] == pytest.approx(10.0 + 2.0 * step, abs=1e-3)


def test_a_path_row_carries_leftover_distance_into_the_next_segment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    use_paths(monkeypatch, PathSpec(((0.0, 0.0), (0.0, 3.0), (10.0, 3.0)), 2.0))
    pool = EnemyPool()
    on_path(pool, x=0.0, y=0.0)
    seen = []
    for _ in range(3):
        pool.step(SHIP_X, SHIP_Y)
        seen.append((float(pool.x[0]), float(pool.y[0]), int(pool.seg[0])))
    assert seen[0] == pytest.approx((0.0, 2.0, 0))
    assert seen[1] == pytest.approx((1.0, 3.0, 1))  # 4 units travelled: 3 down, 1 across
    assert seen[2] == pytest.approx((3.0, 3.0, 1))


def test_a_path_row_can_cross_several_short_segments_in_one_step(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    use_paths(monkeypatch, PathSpec(((0.0, 0.0), (0.0, 1.0), (1.0, 1.0), (1.0, 2.0)), 2.5))
    pool = EnemyPool()
    on_path(pool, x=0.0, y=0.0)
    pool.step(SHIP_X, SHIP_Y)
    assert pool.seg[0] == 2
    assert (pool.x[0], pool.y[0]) == pytest.approx((1.0, 1.5))


def test_after_the_last_point_a_path_row_keeps_going_along_the_last_direction(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    use_paths(monkeypatch, PathSpec(((0.0, 0.0), (0.0, 4.0), (3.0, 8.0)), 1.0))
    pool = EnemyPool()
    on_path(pool, x=50.0, y=0.0)
    for _ in range(15):
        pool.step(SHIP_X, SHIP_Y)
    assert pool.seg[0] == 1  # never advances past the last segment
    # 15 units: 4 along the first segment, 10 along the (0.6, 0.8) second, 1 more beyond its end.
    assert pool.x[0] == pytest.approx(50.0 + 0.6 * 11.0, abs=1e-3)
    assert pool.y[0] == pytest.approx(4.0 + 0.8 * 11.0, abs=1e-3)


def test_a_path_row_faces_the_heading_of_its_current_segment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    use_paths(monkeypatch, PathSpec(((0.0, 0.0), (0.0, 3.0), (10.0, 3.0)), 2.0))
    pool = EnemyPool()
    on_path(pool)
    pool.step(SHIP_X, SHIP_Y)
    assert pool.angle[0] == pytest.approx(math.atan2(0.0, 1.0))
    pool.step(SHIP_X, SHIP_Y)
    assert pool.angle[0] == pytest.approx(math.atan2(1.0, 0.0))


def test_a_mirrored_path_row_flips_its_x_offsets_and_heading(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    use_paths(monkeypatch, PathSpec(((0.0, 0.0), (0.0, 3.0), (10.0, 3.0)), 2.0))
    pool = EnemyPool()
    on_path(pool, x=100.0, y=0.0, flip=-1)
    pool.step(SHIP_X, SHIP_Y)
    pool.step(SHIP_X, SHIP_Y)
    assert (pool.x[0], pool.y[0]) == pytest.approx((99.0, 3.0))
    assert pool.angle[0] == pytest.approx(math.atan2(-1.0, 0.0))


def test_a_ground_kind_on_a_path_adds_the_ground_scroll_to_its_base_row(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    use_paths(monkeypatch, PathSpec(((0.0, 0.0), (0.0, 600.0)), 0.25))
    pool = EnemyPool()
    on_path(pool, EnemyKind.TANK, x=80.0, y=-16.0)
    for step in range(1, 41):
        pool.step(SHIP_X, SHIP_Y, 0.5)
        assert pool.y[0] == pytest.approx(-16.0 + (0.5 + 0.25) * step, abs=1e-3)
    assert pool.base_y[0] == pytest.approx(-16.0 + 0.5 * 40, abs=1e-3)


def test_a_road_following_tank_slows_with_the_terrain(monkeypatch: pytest.MonkeyPatch) -> None:
    use_paths(monkeypatch, PathSpec(((0.0, 0.0), (0.0, 600.0)), 0.25))
    pool = EnemyPool()
    on_path(pool, EnemyKind.TANK, x=80.0, y=0.0)
    pool.step(SHIP_X, SHIP_Y, 0.0)  # the terrain has stopped: only the tank's own drive remains
    assert pool.y[0] == pytest.approx(0.25, abs=1e-5)


def test_an_air_kind_on_a_path_ignores_the_ground_scroll(monkeypatch: pytest.MonkeyPatch) -> None:
    use_paths(monkeypatch, PathSpec(((0.0, 0.0), (0.0, 600.0)), 2.0))
    pool = EnemyPool()
    on_path(pool, EnemyKind.JET, y=0.0)
    pool.step(SHIP_X, SHIP_Y, 5.0)
    assert pool.y[0] == pytest.approx(2.0, abs=1e-5)


def test_a_turret_on_a_path_keeps_aiming_at_the_player(monkeypatch: pytest.MonkeyPatch) -> None:
    use_paths(monkeypatch, PathSpec(((0.0, 0.0), (0.0, 600.0)), 0.25))
    pool = EnemyPool()
    on_path(pool, EnemyKind.TANK, x=60.0, y=40.0)
    pool.step(180.0, 280.0, 0.0)
    assert pool.aux[0] == pytest.approx(math.atan2(180.0 - 60.0, 280.0 - 40.25), abs=1e-4)


def test_a_path_row_going_up_is_removed_above_twice_the_exit_margin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    use_paths(monkeypatch, PathSpec(((0.0, 0.0), (0.0, -500.0)), 5.0))
    pool = EnemyPool()
    ring = EventRing()
    on_path(pool, y=0.0)
    top = -2.0 * ENEMY_EXIT_MARGIN
    steps = 0
    while pool.n and steps < 100:
        pool.step(SHIP_X, SHIP_Y)
        steps += 1
        if pool.n:
            assert pool.y[0] >= top
    assert pool.n == 0
    assert steps == 10  # y reaches -50, past -48
    pool.remove_dead(ring)
    assert (pool.kills, ring.n) == (0, 0)


def test_a_path_row_just_below_the_top_exit_line_stays(monkeypatch: pytest.MonkeyPatch) -> None:
    use_paths(monkeypatch, PathSpec(((0.0, 0.0), (0.0, -500.0)), 1.0))
    pool = EnemyPool()
    on_path(pool, y=-2.0 * ENEMY_EXIT_MARGIN + 2.0)
    pool.step(SHIP_X, SHIP_Y)
    assert pool.n == 1


def test_a_non_path_row_above_the_top_is_not_removed() -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.JET, 100.0, -200.0, MotionKind.DIVE, 0.0, 0.5)
    pool.step(SHIP_X, SHIP_Y)
    assert pool.n == 1  # only PATH rows have a top exit; a diving jet may still be on its way in


@pytest.mark.parametrize(
    ("x", "y"),
    [
        (100.0, PLAYFIELD_H + ENEMY_EXIT_MARGIN),
        (-2 * ENEMY_EXIT_MARGIN - 5.0, 100.0),
        (PLAYFIELD_W + 2 * ENEMY_EXIT_MARGIN + 5.0, 100.0),
    ],
)
def test_a_path_row_is_removed_on_any_other_side(
    monkeypatch: pytest.MonkeyPatch, x: float, y: float
) -> None:
    use_paths(monkeypatch, PathSpec(((0.0, 0.0), (0.0, 10.0)), 1.0))
    pool = EnemyPool()
    on_path(pool, x=x, y=y)
    pool.step(SHIP_X, SHIP_Y)
    assert pool.n == 0


def test_a_scripted_row_never_moves_by_itself() -> None:
    pool = EnemyPool()
    assert pool.spawn(EnemyKind.CARRIER, 120.0, 60.0, MotionKind.SCRIPTED, 1.0, 1.0)
    for _ in range(1000):
        pool.step(SHIP_X, SHIP_Y)
    assert (pool.x[0], pool.y[0]) == (120.0, 60.0)
    assert pool.age[0] == 1000


@pytest.mark.parametrize(
    ("x", "y"),
    [
        (100.0, PLAYFIELD_H + 3 * ENEMY_EXIT_MARGIN),
        (-5 * ENEMY_EXIT_MARGIN, 100.0),
        (PLAYFIELD_W + 5 * ENEMY_EXIT_MARGIN, 100.0),
        (100.0, -5 * ENEMY_EXIT_MARGIN),
    ],
)
def test_a_scripted_row_outside_every_exit_margin_is_never_removed(x: float, y: float) -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.CARRIER, x, y, MotionKind.SCRIPTED, 0.0, 0.0)
    for _ in range(1000):
        pool.step(SHIP_X, SHIP_Y)
    assert pool.n == 1
    assert (pool.x[0], pool.y[0]) == (x, y)


def test_a_scripted_row_still_flashes_down_and_dies_at_zero_hp() -> None:
    pool = EnemyPool()
    ring = EventRing()
    pool.spawn(EnemyKind.CARRIER, 120.0, 60.0, MotionKind.SCRIPTED, 0.0, 0.0)
    pool.apply_hit(0, 1, ring)
    assert pool.flash[0] == ENEMY_FLASH_TICKS
    for _ in range(ENEMY_FLASH_TICKS):
        pool.step(SHIP_X, SHIP_Y)
    assert pool.flash[0] == 0
    pool.apply_hit(0, 10_000, ring)
    pool.remove_dead(ring)
    assert pool.n == 0
    assert pool.kills == 1


def test_clear_empties_the_pool_and_the_kill_buffer_but_keeps_the_uid_counter() -> None:
    pool = EnemyPool()
    jet(pool)
    jet(pool)
    last_uid = int(pool.uid[1])
    pool.hp[1] = 0
    pool.remove_dead(EventRing())
    assert (pool.n, pool.kill_n) == (1, 1)
    pool.clear()
    assert (pool.n, pool.kill_n) == (0, 0)
    assert pool.kills == 1  # the cumulative counter is the game's to reset
    jet(pool)
    assert pool.uid[0] > last_uid  # uids are never reused


# --- boss rows: hp / radius / shield overrides, stumps and removal by uid (ENMY-06, ENMY-07) ---


def scripted_train(pool: EnemyPool, kind: EnemyKind = EnemyKind.TRAIN, **kwargs: float) -> int:
    assert pool.spawn(kind, 120.0, 60.0, MotionKind.SCRIPTED, 0.0, 0.0, **kwargs)
    return pool.n - 1


def test_spawn_overrides_hp_radius_and_shield_and_records_hp_max() -> None:
    pool = EnemyPool()
    i = scripted_train(pool, hp=900, radius=20.0, shield=7)
    assert (pool.hp[i], pool.hp_max[i], pool.radius[i], pool.shield[i]) == (900, 900, 20.0, 7)


def test_spawn_without_overrides_takes_the_kind_defaults_and_no_shield() -> None:
    pool = EnemyPool()
    i = scripted_train(pool, EnemyKind.TRAIN_TURRET)
    assert pool.hp[i] == pool.hp_max[i] == ENEMY_HP[EnemyKind.TRAIN_TURRET]
    assert pool.radius[i] == ENEMY_RADIUS[EnemyKind.TRAIN_TURRET]
    assert pool.shield[i] == 0


def test_a_spawn_with_no_hit_points_is_a_loud_error() -> None:
    pool = EnemyPool()
    with pytest.raises(ValueError, match="hp"):
        pool.spawn(EnemyKind.TRAIN, 0.0, 0.0, MotionKind.SCRIPTED, 0.0, 0.0, hp=0)
    assert pool.n == 0


def test_pack_writes_the_hp_fraction_of_the_row_hp_max() -> None:
    pool = EnemyPool()
    i = scripted_train(pool, hp=800)
    pool.hp[i] = 200
    out = array("f", bytes(4 * ENEMY_STRIDE))
    pool.pack_into(out)
    assert out[4] == pytest.approx(0.25)
    assert out[5] == EnemyKind.TRAIN


def test_a_shielded_row_takes_no_damage_no_flash_and_pushes_no_event() -> None:
    pool = EnemyPool()
    ring = EventRing()
    i = scripted_train(pool, hp=50, shield=-1)
    pool.apply_hit(i, 10, ring)
    assert (pool.hp[i], pool.flash[i], ring.n) == (50, 0, 0)


def test_a_positive_shield_counts_down_one_per_step_then_hits_land() -> None:
    pool = EnemyPool()
    ring = EventRing()
    i = scripted_train(pool, hp=50, shield=3)
    for left in (2, 1, 0):
        pool.step(SHIP_X, SHIP_Y)
        assert pool.shield[i] == left
    pool.apply_hit(i, 10, ring)
    assert pool.hp[i] == 40


def test_a_permanent_shield_never_counts_down() -> None:
    pool = EnemyPool()
    i = scripted_train(pool, shield=-1)
    for _ in range(5):
        pool.step(SHIP_X, SHIP_Y)
    assert pool.shield[i] == -1


def test_the_shield_follows_its_row_through_a_swap_remove() -> None:
    pool = EnemyPool()
    jet(pool)
    scripted_train(pool, shield=-1)
    pool._remove_at(0)
    assert pool.shield[0] == -1
    assert pool.kind[0] == EnemyKind.TRAIN


def test_a_train_turret_aims_at_the_ship() -> None:
    pool = EnemyPool()
    i = scripted_train(pool, EnemyKind.TRAIN_TURRET)
    pool.step(SHIP_X + 60.0, SHIP_Y)
    assert pool.aux[i] == pytest.approx(math.atan2(60.0, SHIP_Y - 60.0))


def test_become_stump_converts_the_row_in_place() -> None:
    pool = EnemyPool()
    jet(pool)
    i = scripted_train(pool, EnemyKind.TRAIN_TURRET, hp=40)
    uid = int(pool.uid[i])
    pool.hp[i] = -5
    pool.pattern[i] = 2
    pool.become_stump(i, EnemyKind.TRAIN_STUMP)
    assert pool.uid[i] == uid
    assert (pool.x[i], pool.y[i]) == (120.0, 60.0)
    assert pool.kind[i] == EnemyKind.TRAIN_STUMP
    assert (pool.hp[i], pool.hp_max[i], pool.shield[i]) == (1, 1, -1)
    assert pool.radius[i] == ENEMY_RADIUS[EnemyKind.TRAIN_STUMP]
    assert pool.pattern[i] == -1


def test_a_stump_survives_remove_dead() -> None:
    pool = EnemyPool()
    i = scripted_train(pool, EnemyKind.TRAIN_TURRET, hp=40)
    pool.hp[i] = 0
    pool.become_stump(i, EnemyKind.TRAIN_STUMP)
    pool.remove_dead(EventRing())
    assert pool.n == 1
    assert pool.kills == 0


def test_remove_uid_removes_that_row_without_a_kill_or_an_event() -> None:
    pool = EnemyPool()
    ring = EventRing()
    jet(pool)
    i = scripted_train(pool)
    uid = int(pool.uid[i])
    assert pool.remove_uid(uid)
    assert pool.n == 1
    assert pool.index_of_uid(uid) == -1
    assert (pool.kills, pool.kill_n, ring.n) == (0, 0, 0)


def test_remove_uid_is_false_when_the_row_is_already_gone() -> None:
    pool = EnemyPool()
    i = scripted_train(pool)
    uid = int(pool.uid[i])
    assert pool.remove_uid(uid)
    assert not pool.remove_uid(uid)
    assert not pool.remove_uid(9999)
