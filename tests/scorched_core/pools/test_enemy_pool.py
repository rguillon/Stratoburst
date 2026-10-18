import math
from array import array

import pytest

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import (
    BLAST_LARGE,
    BLAST_MEDIUM,
    BLAST_SMALL,
    ENEMY_CAP,
    ENEMY_STRIDE,
    EV_EXPLOSION,
    EV_HIT,
    EVENT_STRIDE,
    PLAYFIELD_H,
    PLAYFIELD_W,
)
from scorched_core.tuning import (
    ENEMY_EXIT_MARGIN,
    ENEMY_FLASH_TICKS,
    ENEMY_HP,
    ENEMY_MAX_ALIVE,
    ENEMY_RADIUS,
    ENEMY_SWAY,
    ENEMY_SWAY_PERIOD,
)


def jet(pool: EnemyPool, x: float = 120.0, y: float = 100.0, vy: float = 0.9) -> int:
    assert pool.spawn(EnemyKind.JET, x, y, 0.0, vy)
    return pool.n - 1


def test_spawn_fills_the_kind_row_with_a_fresh_uid() -> None:
    pool = EnemyPool()
    assert pool.spawn(EnemyKind.JET, 120.0, -12.0, 0.0, 0.9)
    assert pool.n == 1
    assert (pool.x[0], pool.y[0], pool.base_x[0]) == (120.0, -12.0, 120.0)
    assert (pool.kind[0], pool.radius[0], pool.hp[0]) == (EnemyKind.JET, 9.0, 3)
    assert (pool.flash[0], pool.age[0], pool.drop[0], pool.uid[0]) == (0, 0, -1, 1)


def test_each_kind_takes_its_radius_and_hp_from_the_tables() -> None:
    pool = EnemyPool()
    for kind in EnemyKind:
        pool.spawn(kind, 100.0, 50.0, 0.0, 0.0, drop=int(kind))
    assert [pool.radius[i] for i in range(pool.n)] == list(ENEMY_RADIUS)
    assert [pool.hp[i] for i in range(pool.n)] == list(ENEMY_HP)
    assert [pool.drop[i] for i in range(pool.n)] == [0, 1, 2, 3, 4]


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
        assert pool.spawn(EnemyKind.JET, 100.0, 0.0, 0.0, 0.0)
    assert not pool.spawn(EnemyKind.JET, 100.0, 0.0, 0.0, 0.0)
    assert pool.n == ENEMY_MAX_ALIVE < ENEMY_CAP


def test_a_step_moves_down_and_follows_the_sine_sway() -> None:
    pool = EnemyPool()
    jet(pool, y=0.0)
    for k in range(1, 61):
        pool.step()
        expected = 120.0 + ENEMY_SWAY * math.sin(k * math.tau / ENEMY_SWAY_PERIOD)
        assert pool.x[0] == pytest.approx(expected, abs=2e-3), k
    assert pool.y[0] == pytest.approx(60 * 0.9, abs=1e-3)
    assert pool.age[0] == 60


def test_vx_drifts_the_sway_centre() -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.JET, 100.0, 0.0, 0.5, 0.0)
    for _ in range(ENEMY_SWAY_PERIOD):
        pool.step()
    assert pool.x[0] == pytest.approx(100.0 + 0.5 * ENEMY_SWAY_PERIOD, abs=1e-2)


def test_the_angle_is_the_heading_of_the_steps_displacement() -> None:
    pool = EnemyPool()
    jet(pool, y=0.0, vy=1.0)
    previous = pool.x[0]
    pool.step()
    assert pool.angle[0] == pytest.approx(math.atan2(pool.x[0] - previous, 1.0), abs=1e-5)
    assert pool.angle[0] > 0.0  # the first sway step swings right


def test_flash_decays_by_one_per_step_to_zero() -> None:
    pool = EnemyPool()
    jet(pool)
    pool.apply_hit(0, 1, EventRing())
    seen = []
    for _ in range(ENEMY_FLASH_TICKS + 2):
        pool.step()
        seen.append(pool.flash[0])
    assert seen == [3, 2, 1, 0, 0, 0]


def test_an_enemy_below_the_exit_line_leaves_without_a_kill_or_event() -> None:
    ring = EventRing()
    pool = EnemyPool()
    jet(pool, y=PLAYFIELD_H + ENEMY_EXIT_MARGIN)
    pool.step()
    pool.remove_dead(ring)
    assert pool.n == 0
    assert pool.kills == 0
    assert ring.n == 0


def test_an_enemy_just_inside_the_exit_line_stays() -> None:
    pool = EnemyPool()
    jet(pool, y=PLAYFIELD_H + ENEMY_EXIT_MARGIN - 1.0)
    pool.step()
    assert pool.n == 1


@pytest.mark.parametrize(
    "x", [-2 * ENEMY_EXIT_MARGIN - 5.0, PLAYFIELD_W + 2 * ENEMY_EXIT_MARGIN + 5.0]
)
def test_an_enemy_far_outside_either_side_leaves(x: float) -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.JET, x, 100.0, 0.0, 0.0)
    pool.step()
    assert pool.n == 0
    assert pool.kills == 0


def test_a_leaver_swap_removal_keeps_the_other_enemies_stepping() -> None:
    pool = EnemyPool()
    jet(pool, y=PLAYFIELD_H + ENEMY_EXIT_MARGIN)
    jet(pool, x=60.0, y=10.0)
    jet(pool, x=180.0, y=20.0)
    pool.step()
    assert pool.n == 2
    assert sorted(round(pool.y[i], 1) for i in range(2)) == [10.9, 20.9]
    assert all(pool.age[i] == 1 for i in range(2))


def test_a_hit_on_a_resting_enemy_pushes_one_low_priority_hit_with_its_kind() -> None:
    ring = EventRing()
    pool = EnemyPool()
    pool.spawn(EnemyKind.HELI, 60.0, 90.0, 0.0, 0.0)
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
    pool.spawn(EnemyKind.HELI, 60.0, 90.0, 0.0, 0.0)
    pool.apply_hit(0, 1, ring)
    pool.flash[0] = 0
    pool.apply_hit(0, 1, ring)
    assert ring.n == 2


def test_the_damage_argument_is_subtracted() -> None:
    pool = EnemyPool()
    pool.spawn(EnemyKind.CARRIER, 60.0, 90.0, 0.0, 0.0)
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
    pool.spawn(kind, 60.0, 90.0, 0.0, 0.0)
    pool.hp[0] = 0
    pool.remove_dead(ring)
    assert list(ring.buf[:EVENT_STRIDE]) == [EV_EXPLOSION, 60.0, 90.0, blast, ground, float(kind)]
    assert (pool.n, pool.kills) == (0, 1)


def test_the_kill_buffer_records_position_kind_and_drop_and_resets_each_call() -> None:
    ring = EventRing()
    pool = EnemyPool()
    pool.spawn(EnemyKind.TANK, 30.0, 40.0, 0.0, 0.0, drop=2)
    pool.spawn(EnemyKind.JET, 50.0, 60.0, 0.0, 0.0)
    pool.spawn(EnemyKind.HELI, 70.0, 80.0, 0.0, 0.0, drop=1)
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
    pool.spawn(EnemyKind.HELI, 60.0, 90.0, 0.0, 0.0)
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
