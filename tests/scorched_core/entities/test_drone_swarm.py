import math
import random
from array import array

import pytest

from scorched_core.entities.drone_swarm import DroneSwarm
from scorched_core.protocol import DRONE_CAP, DRONE_STRIDE, PLAYFIELD_H, PLAYFIELD_W
from scorched_core.tuning import (
    DRONE_FLASH_TICKS,
    DRONE_HP,
    DRONE_MAX_ALIVE,
    DRONE_RADIUS,
    DRONE_SPAWN_INTERVAL,
    DRONE_SPAWN_MARGIN_X,
    DRONE_SPEED,
    DRONE_SWAY,
    DRONE_SWAY_PERIOD,
)


def make_swarm(seed: int = 1) -> DroneSwarm:
    return DroneSwarm(random.Random(seed))  # noqa: S311


def swarm_with_one_drone() -> DroneSwarm:
    swarm = make_swarm()
    for _ in range(DRONE_SPAWN_INTERVAL):
        swarm.step()
    assert swarm.n == 1
    return swarm


def test_no_drone_exists_for_the_first_thirty_nine_steps() -> None:
    swarm = make_swarm()
    for _ in range(DRONE_SPAWN_INTERVAL - 1):
        swarm.step()
        assert swarm.n == 0


def test_the_first_drone_appears_on_step_thirty_nine_above_the_top_edge() -> None:
    swarm = make_swarm()
    for _ in range(DRONE_SPAWN_INTERVAL):
        swarm.step()
    assert swarm.n == 1
    assert swarm.y[0] == pytest.approx(-12.0)
    assert DRONE_SPAWN_MARGIN_X <= swarm.x[0] <= 240.0 - DRONE_SPAWN_MARGIN_X
    assert swarm.hp[0] == DRONE_HP
    assert swarm.flash[0] == 0


def test_spawn_x_stays_within_the_margins_for_many_spawns() -> None:
    swarm = make_swarm(5)
    seen: list[float] = []
    for _ in range(DRONE_SPAWN_INTERVAL * 6):
        swarm.step()
        seen.extend(swarm.base_x[i] for i in range(swarm.n))
    assert seen
    assert all(DRONE_SPAWN_MARGIN_X <= v <= 240.0 - DRONE_SPAWN_MARGIN_X for v in seen)


@pytest.mark.parametrize("seed", [1, 2, 3, 5, 99])
def test_a_drone_stays_wholly_inside_the_playfield_for_its_whole_lifetime(seed: int) -> None:
    swarm = make_swarm(seed)
    tolerance = 1e-3  # positions are stored as float32
    for _ in range(20_000):
        swarm.step()
        for i in range(swarm.n):
            assert DRONE_RADIUS - tolerance <= swarm.x[i] <= PLAYFIELD_W - DRONE_RADIUS + tolerance


def test_a_drone_spawns_every_forty_steps() -> None:
    swarm = make_swarm()
    counts = []
    for step in range(1, DRONE_SPAWN_INTERVAL * 3 + 1):
        swarm.step()
        if step % DRONE_SPAWN_INTERVAL == 0:
            counts.append(swarm.n)
    assert counts == [1, 2, 3]


def test_never_more_than_ten_alive() -> None:
    swarm = make_swarm()
    for i in range(DRONE_SPAWN_INTERVAL * 14):
        swarm.step()
        # Pin them at the top so none leaves the screen while we test the cap.
        for j in range(swarm.n):
            swarm.y[j] = 0.0
        assert swarm.n <= DRONE_MAX_ALIVE, i
    assert swarm.n == DRONE_MAX_ALIVE
    assert DRONE_MAX_ALIVE < DRONE_CAP


def test_a_drone_moves_down_zero_point_nine_per_step() -> None:
    swarm = swarm_with_one_drone()
    y0 = swarm.y[0]
    swarm.step()
    assert swarm.y[0] - y0 == pytest.approx(DRONE_SPEED, abs=1e-4)


def test_x_follows_the_base_plus_a_sine_sway() -> None:
    swarm = swarm_with_one_drone()
    base = swarm.base_x[0]
    for k in range(1, 61):
        swarm.step()
        expected = base + DRONE_SWAY * math.sin(k * math.tau / DRONE_SWAY_PERIOD)
        assert swarm.x[0] == pytest.approx(expected, abs=2e-3), k
    assert swarm.x[0] == pytest.approx(base, abs=2e-3)  # half a period back at the base


def test_two_hits_leave_a_three_hp_drone_alive_and_flashing() -> None:
    swarm = swarm_with_one_drone()
    swarm.apply_hit(0)
    swarm.apply_hit(0)
    swarm.remove_dead()
    assert swarm.n == 1
    assert swarm.hp[0] == DRONE_HP - 2
    assert swarm.flash[0] == DRONE_FLASH_TICKS == 6
    assert swarm.destroyed == 0


def test_the_third_hit_removes_the_drone_and_counts_it_destroyed() -> None:
    swarm = swarm_with_one_drone()
    for _ in range(3):
        swarm.apply_hit(0)
    swarm.remove_dead()
    assert swarm.n == 0
    assert swarm.destroyed == 1


def test_remove_dead_swap_removes_and_keeps_the_survivors_intact() -> None:
    swarm = make_swarm()
    for _ in range(DRONE_SPAWN_INTERVAL * 3):
        swarm.step()
    assert swarm.n == 3
    survivors = {(round(swarm.x[i], 3), round(swarm.y[i], 3)) for i in (0, 2)}
    for _ in range(3):
        swarm.apply_hit(1)
    swarm.remove_dead()
    assert swarm.n == 2
    assert {(round(swarm.x[i], 3), round(swarm.y[i], 3)) for i in range(2)} == survivors
    assert swarm.destroyed == 1


def test_remove_dead_clears_several_dead_drones_in_one_pass() -> None:
    swarm = make_swarm()
    for _ in range(DRONE_SPAWN_INTERVAL * 4):
        swarm.step()
    for i in (0, 1, 3):
        for _ in range(3):
            swarm.apply_hit(i)
    swarm.remove_dead()
    assert swarm.n == 1
    assert swarm.destroyed == 3
    assert swarm.hp[0] == DRONE_HP


def test_flash_decays_by_one_per_step_to_zero() -> None:
    swarm = swarm_with_one_drone()
    swarm.apply_hit(0)
    seen = []
    for _ in range(DRONE_FLASH_TICKS + 2):
        swarm.step()
        seen.append(swarm.flash[0])
    assert seen == [5, 4, 3, 2, 1, 0, 0, 0]


def test_a_drone_below_the_bottom_edge_leaves_without_counting_as_destroyed() -> None:
    swarm = swarm_with_one_drone()
    swarm.y[0] = PLAYFIELD_H + 16.0
    swarm.step()  # now just past the margin
    assert swarm.n == 0
    assert swarm.destroyed == 0


def test_a_drone_just_inside_the_removal_line_stays() -> None:
    swarm = swarm_with_one_drone()
    swarm.y[0] = PLAYFIELD_H + 15.0  # one step later: 335.9, still inside the 336 line
    swarm.step()
    assert swarm.n == 1


def test_a_drone_that_flies_the_whole_screen_is_removed_eventually() -> None:
    swarm = swarm_with_one_drone()
    for _ in range(int((PLAYFIELD_H + 40) / DRONE_SPEED)):
        swarm.step()
        if swarm.n == 0:
            break
    # A later spawn may be present; the first one is certainly gone by now.
    assert swarm.destroyed == 0
    assert all(swarm.y[i] < PLAYFIELD_H for i in range(swarm.n))


def test_the_same_seed_spawns_the_same_swarm() -> None:
    a, b = make_swarm(3), make_swarm(3)
    for _ in range(300):
        a.step()
        b.step()
    assert a.x.tobytes() == b.x.tobytes()
    assert a.y.tobytes() == b.y.tobytes()
    other = make_swarm(4)
    for _ in range(300):
        other.step()
    assert other.base_x.tobytes() != a.base_x.tobytes()


def test_pack_writes_stride_eight_with_normalised_flash_and_hp() -> None:
    swarm = swarm_with_one_drone()
    swarm.apply_hit(0)
    out = array("f", [9.0]) * (DRONE_STRIDE * DRONE_CAP)
    swarm.pack_into(out)
    assert out[0] == swarm.x[0]
    assert out[1] == swarm.y[0]
    assert out[2] == 0.0
    assert out[3] == pytest.approx(DRONE_FLASH_TICKS / DRONE_FLASH_TICKS)
    assert out[4] == pytest.approx((DRONE_HP - 1) / DRONE_HP)
    assert (out[5], out[6], out[7]) == (1.0, 0.0, 0.0)
    assert out[DRONE_STRIDE] == 9.0  # the tail beyond the live drones is untouched


def test_pack_with_no_drones_writes_nothing() -> None:
    out = array("f", [7.0]) * (DRONE_STRIDE * DRONE_CAP)
    make_swarm().pack_into(out)
    assert set(out) == {7.0}
