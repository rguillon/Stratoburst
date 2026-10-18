import math
from array import array

import pytest

from scorched_core.pools.bullet_pool import BulletPool


def filled(count: int, capacity: int = 8) -> BulletPool:
    pool = BulletPool(capacity)
    for i in range(count):
        assert pool.spawn(float(i), float(10 + i), 1.0, -2.0)
    return pool


def test_spawn_respects_capacity() -> None:
    pool = BulletPool(4)
    assert [pool.spawn(0.0, 0.0, 0.0, 0.0) for _ in range(5)] == [True, True, True, True, False]
    assert pool.n == 4


def test_new_pool_is_empty() -> None:
    assert BulletPool(3).n == 0


def test_remove_at_swaps_the_last_bullet_into_the_slot() -> None:
    pool = filled(3)
    pool.remove_at(0)
    assert pool.n == 2
    assert (pool.x[0], pool.y[0]) == (2.0, 12.0)
    assert (pool.x[1], pool.y[1]) == (1.0, 11.0)


def test_remove_at_the_last_slot_just_shrinks() -> None:
    pool = filled(3)
    pool.remove_at(2)
    assert pool.n == 2
    assert (pool.x[0], pool.x[1]) == (0.0, 1.0)


def test_removing_the_only_bullet_empties_the_pool() -> None:
    pool = filled(1)
    pool.remove_at(0)
    assert pool.n == 0


def test_integrate_moves_only_the_live_bullets() -> None:
    pool = filled(2, capacity=4)
    pool.x[3] = 99.0  # dead slot must stay untouched
    pool.vx[3] = 1.0
    pool.integrate()
    assert (pool.x[0], pool.y[0]) == (1.0, 8.0)
    assert (pool.x[1], pool.y[1]) == (2.0, 9.0)
    assert pool.x[3] == 99.0


def test_cull_outside_removes_only_bullets_outside_the_box() -> None:
    pool = BulletPool(8)
    for x, y in [(5.0, 5.0), (-1.0, 5.0), (5.0, 50.0), (10.0, 10.0), (11.0, 5.0)]:
        pool.spawn(x, y, 0.0, 0.0)
    pool.cull_outside(0.0, 0.0, 10.0, 10.0)
    survivors = sorted((pool.x[i], pool.y[i]) for i in range(pool.n))
    assert survivors == [(5.0, 5.0), (10.0, 10.0)]


def test_cull_outside_keeps_everything_when_all_inside() -> None:
    pool = filled(3)
    pool.cull_outside(-100.0, -100.0, 100.0, 100.0)
    assert pool.n == 3


def test_pack_into_writes_x_y_angle_kind_at_stride_four() -> None:
    pool = filled(2)
    out = array("f", [-7.0] * 16)
    pool.pack_into(out, 1.0)
    angle = math.atan2(1.0, 2.0)  # filled() flies each bolt at (1, -2)
    assert list(out[:8]) == pytest.approx([0.0, 10.0, angle, 1.0, 1.0, 11.0, angle, 1.0])
    assert list(out[8:]) == [-7.0] * 8


def test_pack_into_overwrites_a_stale_slot_two() -> None:
    pool = BulletPool(2)
    pool.spawn(0.0, 10.0, 0.0, -4.0)
    out = array("f", [5.0] * 8)
    pool.pack_into(out, 2.0)
    assert list(out[:4]) == [0.0, 10.0, 0.0, 2.0]


@pytest.mark.parametrize(
    ("vx", "vy", "expected"),
    [
        (0.0, -4.0, 0.0),
        (4.0, 0.0, math.pi / 2),
        (-4.0, 0.0, -math.pi / 2),
        (0.0, 4.0, math.pi),
        (3.0, -3.0, math.pi / 4),
        (-3.0, -3.0, -math.pi / 4),
    ],
)
def test_spawn_stores_the_flight_angle(vx: float, vy: float, expected: float) -> None:
    pool = BulletPool(2)
    pool.spawn(0.0, 0.0, vx, vy)
    assert pool.angle[0] == pytest.approx(expected, abs=1e-6)


def test_pack_into_writes_the_flight_angle_in_slot_two() -> None:
    pool = BulletPool(4)
    pool.spawn(0.0, 0.0, 0.0, -4.0)
    pool.spawn(1.0, 1.0, 4.0, 0.0)
    pool.spawn(2.0, 2.0, -3.0, -3.0)
    out = array("f", bytes(4 * 16))
    pool.pack_into(out, 0.0)
    assert out[2] == 0.0  # straight up still packs exactly 0
    assert out[6] == pytest.approx(math.pi / 2, abs=1e-6)
    assert out[10] == pytest.approx(-math.pi / 4, abs=1e-6)


def test_remove_at_moves_the_angle_with_the_bullet() -> None:
    pool = BulletPool(4)
    pool.spawn(0.0, 0.0, 0.0, -4.0)
    pool.spawn(1.0, 1.0, 4.0, 0.0)
    pool.spawn(2.0, 2.0, 0.0, 4.0)
    pool.remove_at(0)
    assert pool.angle[0] == pytest.approx(math.pi, abs=1e-6)
    assert pool.angle[1] == pytest.approx(math.pi / 2, abs=1e-6)
    out = array("f", bytes(4 * 8))
    pool.pack_into(out, 0.0)
    assert (out[2], out[6]) == pytest.approx((math.pi, math.pi / 2), abs=1e-6)


def test_pack_into_follows_a_changed_kind() -> None:
    pool = filled(2)
    out = array("f", bytes(4 * 8))
    pool.pack_into(out, 1.0)
    pool.pack_into(out, 3.0)
    assert (out[3], out[7]) == (3.0, 3.0)


def test_pack_into_an_empty_pool_writes_nothing() -> None:
    out = array("f", [9.0] * 8)
    BulletPool(4).pack_into(out, 1.0)
    assert list(out) == [9.0] * 8


@pytest.mark.parametrize("capacity", [1, 600])
def test_columns_are_sized_to_capacity(capacity: int) -> None:
    pool = BulletPool(capacity)
    assert {len(pool.x), len(pool.y), len(pool.vx), len(pool.vy), len(pool.angle)} == {capacity}
