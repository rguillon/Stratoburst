import itertools
import random
import sys

import pytest

from scorched_core.clock.fixed_step_runner import STEP_MS
from scorched_core.game.game import Game
from scorched_core.input.button import Button
from scorched_core.protocol import (
    DRONE_CAP,
    DRONE_STRIDE,
    EBULLET_STRIDE,
    FLAG_FIRING,
    FLAG_PAUSED,
    H_ALPHA,
    H_DRONE_N,
    H_DRONES_DOWN,
    H_EBULLET_N,
    H_FLAGS,
    H_PBULLET_N,
    H_SCROLL_Y,
    H_SHIP_X,
    H_SHIP_Y,
    H_STEPS,
    H_STORM_HITS,
    H_TICK_COUNT,
    HEADER_LEN,
    PBULLET_CAP,
    PBULLET_STRIDE,
)
from scorched_core.tuning import SHIP_SPEED, SHIP_START_X, SHIP_START_Y


def test_manifest_contract() -> None:
    manifest = Game().manifest()
    assert manifest["protocol"] == 1
    assert manifest["playfield"] == {"w": 240.0, "h": 320.0}
    header = manifest["header"]
    assert header["len"] == HEADER_LEN
    assert header["slots"]["STEPS"] == 0
    assert header["slots"]["SHIP_X"] == H_SHIP_X
    assert header["slots"]["DRONES_DOWN"] == 11
    assert len(header["slots"]) == 12
    assert manifest["channels"] == {
        "pbullets": {"stride": PBULLET_STRIDE, "cap": PBULLET_CAP},
        "ebullets": {"stride": EBULLET_STRIDE, "cap": 600},
        "drones": {"stride": DRONE_STRIDE, "cap": DRONE_CAP},
    }
    assert manifest["flags"] == {"PAUSED": 1, "FIRING": 2}


def test_manifest_publishes_the_button_bits_so_js_never_hardcodes_them() -> None:
    assert Game().manifest()["buttons"] == {"FIRE": 1, "BOMB": 2, "PAUSE": 4}


def test_fire_button_sets_the_firing_flag_and_releasing_clears_it() -> None:
    game = Game()
    game.tick(STEP_MS, Button.FIRE, 0.0, 0.0, 0.0, 0.0)
    assert int(game.buffers["header"][H_FLAGS]) & FLAG_FIRING
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert int(game.buffers["header"][H_FLAGS]) & FLAG_FIRING == 0


def test_firing_flag_is_set_on_a_zero_step_tick_too() -> None:
    game = Game()
    game.tick(STEP_MS / 2, 1, 0.0, 0.0, 0.0, 0.0)
    assert int(game.buffers["header"][H_FLAGS]) == FLAG_FIRING


def test_the_bomb_bit_has_no_gameplay_effect_in_phase_one() -> None:
    game = Game()
    game.tick(STEP_MS, Button.BOMB, 0.0, 0.0, 0.0, 0.0)
    assert int(game.buffers["header"][H_FLAGS]) == 0
    assert (game.ship.x, game.ship.y) == (SHIP_START_X, SHIP_START_Y)


def test_manifest_publishes_the_tuning_the_renderer_extrapolates_with() -> None:
    assert Game().manifest()["tuning"] == {"scroll_speed": 0.8, "hitbox_radius": 2.0}


def test_header_scroll_y_follows_the_terrain_steps() -> None:
    game = Game()
    for _ in range(10):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.terrain.distance == pytest.approx(8.0)
    assert game.buffers["header"][H_SCROLL_Y] == pytest.approx(8.0, rel=1e-6)


def test_zero_step_tick_repacks_the_current_scroll() -> None:
    game = Game()
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    game.tick(STEP_MS / 2, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["header"][H_SCROLL_Y] == pytest.approx(0.8, rel=1e-6)


@pytest.mark.parametrize(
    ("stress", "stored", "cap"),
    [(0, 0, 600), (600, 600, 600), (750, 750, 750), (99999, 5000, 5000), (-5, 0, 600)],
)
def test_stress_clamping(stress: int, stored: int, cap: int) -> None:
    game = Game(stress=stress)
    assert game.stress == stored
    assert game.ebullet_cap == cap
    assert game.manifest()["channels"]["ebullets"]["cap"] == cap


def test_buffer_lengths_and_zero_fill() -> None:
    game = Game(stress=750)
    assert {name: len(buf) for name, buf in game.buffers.items()} == {
        "header": HEADER_LEN,
        "pbullets": PBULLET_STRIDE * PBULLET_CAP,
        "ebullets": EBULLET_STRIDE * 750,
        "drones": DRONE_STRIDE * DRONE_CAP,
    }
    assert all(v == 0.0 for buf in game.buffers.values() for v in buf)


def test_rng_is_seeded() -> None:
    assert Game(seed=7).rng.random() == Game(seed=7).rng.random()


def test_tick_moves_ship_and_packs_header() -> None:
    game = Game()
    steps = game.tick(STEP_MS, 0, 1.0, 0.0, 0.0, 0.0)
    header = game.buffers["header"]
    assert steps == 1
    assert header[H_STEPS] == 1
    assert header[H_SHIP_X] == pytest.approx(SHIP_START_X + SHIP_SPEED, rel=1e-6)
    assert header[H_SHIP_Y] == pytest.approx(SHIP_START_Y)
    assert header[H_TICK_COUNT] == 1


def test_zero_step_tick_still_packs_header() -> None:
    game = Game()
    steps = game.tick(STEP_MS / 2, 0, 1.0, 0.0, 0.0, 0.0)
    header = game.buffers["header"]
    assert steps == 0
    assert header[H_STEPS] == 0
    assert header[H_ALPHA] == pytest.approx(0.5, rel=1e-6)
    assert header[H_SHIP_X] == pytest.approx(SHIP_START_X)
    assert header[H_TICK_COUNT] == 0


def test_no_stress_means_an_empty_storm() -> None:
    game = Game()
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.storm is None
    assert game.ebullets.n == 0
    assert game.buffers["header"][H_EBULLET_N] == 0


def test_tick_with_no_stress_still_packs_without_error() -> None:
    game = Game()
    for _ in range(5):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert all(v == 0.0 for v in game.buffers["ebullets"])


@pytest.mark.parametrize(("stress", "count"), [(1, 1), (500, 500), (99999, 5000)])
def test_stress_spawns_the_clamped_bullet_count(stress: int, count: int) -> None:
    game = Game(stress=stress)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.ebullets.n == count
    assert game.buffers["header"][H_EBULLET_N] == count


def test_stress_bullets_are_packed_with_kind_one() -> None:
    game = Game(stress=3)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    ebullets = game.buffers["ebullets"]
    assert [ebullets[3], ebullets[7], ebullets[11], ebullets[15]] == [1.0, 1.0, 1.0, 0.0]
    assert ebullets[0] == game.ebullets.x[0]


def test_storm_hits_accumulate_in_the_header_and_do_nothing_else() -> None:
    game = Game(stress=1)
    game.ebullets.x[0] = game.ship.x
    game.ebullets.y[0] = game.ship.y
    game.ebullets.vx[0] = 0.0
    game.ebullets.vy[0] = 0.0
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.storm_hits == 2
    assert game.buffers["header"][H_STORM_HITS] == 2.0


def test_zero_step_tick_leaves_the_ebullet_buffer_alone() -> None:
    game = Game(stress=2)
    game.tick(STEP_MS / 2, 0, 0.0, 0.0, 0.0, 0.0)
    assert all(v == 0.0 for v in game.buffers["ebullets"])
    assert game.buffers["header"][H_EBULLET_N] == 2


def test_same_seed_is_deterministic_and_another_seed_differs() -> None:
    def run(seed: int) -> bytes:
        game = Game(seed=seed, stress=500)
        for _ in range(300):
            game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
        return game.buffers["ebullets"].tobytes()

    assert run(7) == run(7)
    assert run(7) != run(8)


def test_tick_does_not_grow_allocated_blocks() -> None:
    game = Game(stress=500)
    for _ in range(300):  # warm up pools and caches
        game.tick(STEP_MS, 0b1, 0.0, 0.0, 0.0, 0.0)
    before = sys.getallocatedblocks()
    for _ in range(600):
        game.tick(STEP_MS, 0b1, 0.0, 0.0, 0.0, 0.0)
    assert sys.getallocatedblocks() - before < 50


def test_drag_is_queued_once_per_tick_and_caught_up_by_the_steps() -> None:
    game = Game()
    game.tick(STEP_MS, 0, 0.0, 0.0, 10.0, 0.0)
    assert game.ship.x == pytest.approx(SHIP_START_X + SHIP_SPEED)
    assert game.ship.pending_x == pytest.approx(10.0 - SHIP_SPEED)


def test_drag_is_added_once_per_tick_call_not_once_per_step() -> None:
    game = Game()
    game.tick(STEP_MS * 3, 0, 0.0, 0.0, 10.0, 0.0)
    assert game.ship.x == pytest.approx(SHIP_START_X + 10.0)
    assert game.ship.pending_x == 0.0


def test_a_zero_step_tick_keeps_the_drag_for_the_next_tick() -> None:
    game = Game()
    game.tick(STEP_MS / 2, 0, 0.0, 0.0, 10.0, 0.0)
    assert game.ship.x == SHIP_START_X
    assert game.ship.pending_x == 10.0
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.ship.x == pytest.approx(SHIP_START_X + SHIP_SPEED)


def test_a_non_finite_drag_never_moves_the_ship() -> None:
    game = Game()
    game.tick(STEP_MS, 0, 0.0, 0.0, float("nan"), float("inf"))
    assert (game.ship.x, game.ship.y) == (SHIP_START_X, SHIP_START_Y)
    assert (game.ship.pending_x, game.ship.pending_y) == (0.0, 0.0)


def test_a_zero_drag_leaves_pending_alone() -> None:
    game = Game()
    game.ship.pending_x = 5.0
    game.tick(STEP_MS / 2, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.ship.pending_x == 5.0


def _hold_fire(game: Game, ticks: int) -> None:
    for _ in range(ticks):
        game.tick(STEP_MS, Button.FIRE, 0.0, 0.0, 0.0, 0.0)


def test_holding_fire_adds_a_volley_every_five_steps() -> None:
    game = Game()
    _hold_fire(game, 30)  # volleys at steps 0, 5, ..., 25; none has left the screen yet
    assert game.pbullets.n == 12
    assert game.buffers["header"][H_PBULLET_N] == 12


def test_the_first_tick_with_fire_spawns_the_pair_and_moves_it_one_step() -> None:
    game = Game()
    _hold_fire(game, 1)
    ship = game.ship
    xs = sorted((game.pbullets.x[0], game.pbullets.x[1]))
    assert xs == [ship.x - 5.0, ship.x + 5.0]
    assert game.pbullets.y[0] == pytest.approx(ship.y - 10.0 - 8.0)
    packed = game.buffers["pbullets"]
    assert (packed[0], packed[1], packed[2], packed[3]) == (
        game.pbullets.x[0],
        game.pbullets.y[0],
        0.0,
        0.0,
    )
    assert packed[4] == game.pbullets.x[1]


def test_releasing_and_pressing_again_cannot_beat_the_fire_interval() -> None:
    game = Game()
    game.tick(STEP_MS, Button.FIRE, 0.0, 0.0, 0.0, 0.0)  # step 0: volley
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    game.tick(STEP_MS, Button.FIRE, 0.0, 0.0, 0.0, 0.0)  # step 3
    game.tick(STEP_MS, Button.FIRE, 0.0, 0.0, 0.0, 0.0)  # step 4
    assert game.pbullets.n == 2
    game.tick(STEP_MS, Button.FIRE, 0.0, 0.0, 0.0, 0.0)  # step 5
    assert game.pbullets.n == 4


def test_bolts_that_leave_the_playfield_are_culled() -> None:
    game = Game()
    _hold_fire(game, 1)
    for _ in range(60):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.pbullets.n == 0
    assert game.buffers["header"][H_PBULLET_N] == 0


def test_a_full_player_pool_drops_the_volley() -> None:
    game = Game()
    for _ in range(PBULLET_CAP):
        game.pbullets.spawn(10.0, 100.0, 0.0, 0.0)
    _hold_fire(game, 1)
    assert game.pbullets.n == PBULLET_CAP


def test_a_zero_step_tick_reports_the_bolt_count_but_keeps_the_buffer() -> None:
    game = Game()
    _hold_fire(game, 1)
    before = game.buffers["pbullets"].tobytes()
    game.tick(STEP_MS / 2, Button.FIRE, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["header"][H_PBULLET_N] == 2
    assert game.buffers["pbullets"].tobytes() == before


def _sweep_and_fire(game: Game, ticks: int) -> None:
    """A scripted pilot: fire held, sweeping left and right 60 ticks at a time."""
    for tick in range(ticks):
        direction = 1.0 if (tick // 60) % 2 == 0 else -1.0
        game.tick(STEP_MS, Button.FIRE, direction, 0.0, 0.0, 0.0)


def _track_nearest_drone_and_fire(game: Game, ticks: int) -> None:
    """A scripted pilot: steer under the lowest drone and keep fire held."""
    swarm = game.swarm
    for _ in range(ticks):
        move_x = 0.0
        if swarm.n:
            lowest = max(range(swarm.n), key=lambda i: swarm.y[i])
            dx = swarm.x[lowest] - game.ship.x
            move_x = 0.0 if abs(dx) < 2.0 else (1.0 if dx > 0 else -1.0)
        game.tick(STEP_MS, Button.FIRE, move_x, 0.0, 0.0, 0.0)


def test_the_header_counts_drones_from_step_forty_on() -> None:
    game = Game()
    for _ in range(39):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["header"][H_DRONE_N] == 0
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["header"][H_DRONE_N] == 1
    assert game.buffers["header"][H_DRONES_DOWN] == 0


def test_drones_are_packed_into_the_drone_channel() -> None:
    game = Game()
    for _ in range(40):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    drones = game.buffers["drones"]
    assert drones[0] == game.swarm.x[0]
    assert drones[1] == game.swarm.y[0]
    assert drones[5] == 1.0


def test_a_zero_step_tick_keeps_the_drone_buffer_but_reports_the_count() -> None:
    game = Game()
    for _ in range(40):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    before = game.buffers["drones"].tobytes()
    game.tick(STEP_MS / 2, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["drones"].tobytes() == before
    assert game.buffers["header"][H_DRONE_N] == 1


def test_a_bolt_that_reaches_a_drone_costs_it_a_hit_through_the_game_step() -> None:
    game = Game()
    swarm = game.swarm
    swarm.x[0] = swarm.base_x[0] = game.ship.x
    swarm.y[0], swarm.hp[0], swarm.n = game.ship.y - 40.0, 3, 1
    game.pbullets.spawn(game.ship.x, game.ship.y - 30.0, 0.0, -8.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert swarm.hp[0] == 2
    assert game.pbullets.n == 0


def test_drones_down_counts_destroyed_drones_in_the_header() -> None:
    game = Game()
    swarm = game.swarm
    swarm.x[0] = swarm.base_x[0] = game.ship.x
    swarm.y[0], swarm.hp[0], swarm.n = game.ship.y - 40.0, 1, 1
    game.pbullets.spawn(game.ship.x, game.ship.y - 30.0, 0.0, -8.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["header"][H_DRONE_N] == 0
    assert game.buffers["header"][H_DRONES_DOWN] == 1


def test_the_same_seed_and_inputs_give_byte_identical_buffers_determinism() -> None:
    def run(seed: int) -> tuple[bytes, ...]:
        game = Game(seed=seed)
        _sweep_and_fire(game, 600)
        return tuple(game.buffers[name].tobytes() for name in ("header", "pbullets", "drones"))

    assert run(11) == run(11)
    assert run(11) != run(12)


def test_scripted_kill_ship_tracking_the_nearest_drone_downs_three_within_1200_ticks() -> None:
    game = Game()
    _track_nearest_drone_and_fire(game, 1200)
    assert game.buffers["header"][H_DRONES_DOWN] >= 3
    assert game.swarm.destroyed == game.buffers["header"][H_DRONES_DOWN]


def jittered_dts(hz: int, seconds: float = 10.0, jitter_ms: float = 0.4) -> list[float]:
    """rAF deltas for a display at ``hz``: k * period plus seeded Gaussian timestamp jitter."""
    rng = random.Random(1)  # noqa: S311 - seeded test jitter, not security
    period = 1000.0 / hz
    stamps = [k * period + rng.gauss(0.0, jitter_ms) for k in range(round(seconds * hz) + 1)]
    return [0.0] + [b - a for a, b in itertools.pairwise(stamps)]


@pytest.mark.parametrize("hz", [30, 60, 120, 144])
def test_the_simulation_runs_six_hundred_steps_in_ten_seconds_at_any_refresh_rate_hz(
    hz: int,
) -> None:
    game = Game()
    steps = sum(game.tick(dt, 0, 0.0, 0.0, 0.0, 0.0) for dt in jittered_dts(hz))
    assert 599 <= steps <= 601
    assert game.tick_count == steps


def test_vsync_snapping_leaves_under_one_percent_of_60_hz_frames_stuttering_with_jitter() -> None:
    game = Game()
    counts = [game.tick(dt, 0, 0.0, 0.0, 0.0, 0.0) for dt in jittered_dts(60)]
    stutter = sum(1 for n in counts if n != 1)
    assert stutter / len(counts) < 0.01


def test_unjittered_144_hz_frames_also_give_six_hundred_steps_in_ten_seconds_hz() -> None:
    game = Game()
    steps = sum(game.tick(1000.0 / 144.0, 0, 0.0, 0.0, 0.0, 0.0) for _ in range(1440))
    assert 599 <= steps <= 601


def test_a_five_second_gap_runs_at_most_three_steps_and_drops_the_backlog_boundary() -> None:
    game = Game()
    for _ in range(10):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.tick(5000.0, 0, 0.0, 0.0, 0.0, 0.0) == 3
    assert game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0) == 1


def test_the_first_frame_with_a_zero_dt_runs_no_step_boundary() -> None:
    game = Game()
    assert game.tick(0.0, 0, 0.0, 0.0, 0.0, 0.0) == 0
    assert game.tick_count == 0


def flags(game: Game) -> int:
    return int(game.buffers["header"][H_FLAGS])


def test_a_pause_press_pauses_before_any_step_runs_paused() -> None:
    game = Game()
    assert game.tick(STEP_MS, Button.PAUSE, 0.0, 0.0, 0.0, 0.0) == 0
    assert game.paused
    assert game.tick_count == 0
    assert flags(game) == FLAG_PAUSED
    assert game.buffers["header"][H_STEPS] == 0


def test_while_paused_a_five_second_dt_runs_nothing_and_moves_nothing_paused() -> None:
    game = Game()
    game.set_paused(True)
    ticks = game.tick_count
    scroll = game.terrain.distance
    assert game.tick(5000.0, 0, 1.0, 0.0, 0.0, 0.0) == 0
    assert game.tick_count == ticks
    assert game.terrain.distance == scroll
    assert (game.ship.x, game.ship.y) == (SHIP_START_X, SHIP_START_Y)
    assert flags(game) & FLAG_PAUSED
    assert game.buffers["header"][H_STEPS] == 0
    assert game.buffers["header"][H_TICK_COUNT] == ticks


def test_while_paused_the_accumulator_and_estimator_are_left_alone_paused() -> None:
    game = Game()
    game.tick(STEP_MS / 2, 0, 0.0, 0.0, 0.0, 0.0)
    acc = game._runner.acc
    game.set_paused(True)
    for _ in range(5):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game._runner.acc == acc


def test_while_paused_a_drag_is_not_queued_paused() -> None:
    game = Game()
    game.set_paused(True)
    game.tick(STEP_MS, 0, 0.0, 0.0, 30.0, 0.0)
    assert game.ship.pending_x == 0.0


def test_while_paused_the_fire_flag_is_still_reflected_paused() -> None:
    game = Game()
    game.set_paused(True)
    game.tick(STEP_MS, Button.FIRE, 0.0, 0.0, 0.0, 0.0)
    assert flags(game) == FLAG_PAUSED | FLAG_FIRING
    assert game.pbullets.n == 0


def test_set_paused_shows_in_the_header_without_a_tick_paused() -> None:
    game = Game()
    game.set_paused(True)
    assert flags(game) == FLAG_PAUSED
    game.set_paused(False)
    assert flags(game) == 0


def test_resume_after_a_pause_runs_exactly_one_step_for_one_period_resume() -> None:
    game = Game()
    game.set_paused(True)
    game.set_paused(False)
    assert game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0) == 1


def test_resume_zeroes_the_accumulator_resume() -> None:
    game = Game()
    game.tick(STEP_MS * 0.9, 0, 0.0, 0.0, 0.0, 0.0)
    game.set_paused(True)
    game.set_paused(False)
    assert game.tick(STEP_MS * 0.9, 0, 0.0, 0.0, 0.0, 0.0) == 0


def test_resume_forgets_the_refresh_history_resume() -> None:
    game = Game()
    for _ in range(10):
        game.tick(1000.0 / 120.0, 0, 0.0, 0.0, 0.0, 0.0)
    game.set_paused(True)
    game.set_paused(False)
    assert game.refresh.snap(16.9) == 16.9


def test_resume_drops_the_drag_the_ship_still_owed_resume() -> None:
    game = Game()
    game.ship.pending_x = 25.0
    game.set_paused(True)
    game.set_paused(False)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.ship.x == SHIP_START_X


def test_set_paused_false_while_running_is_a_no_op_resume() -> None:
    game = Game()
    game.tick(STEP_MS / 2, 0, 0.0, 0.0, 0.0, 0.0)
    game.set_paused(False)
    assert game.tick(STEP_MS / 2, 0, 0.0, 0.0, 0.0, 0.0) == 1


def test_set_paused_true_twice_is_idempotent_paused() -> None:
    game = Game()
    game.set_paused(True)
    game.set_paused(True)
    game.set_paused(False)
    assert not game.paused
    assert flags(game) == 0


def test_a_second_pause_press_resumes_in_the_same_tick_resume() -> None:
    game = Game()
    game.tick(STEP_MS, Button.PAUSE, 0.0, 0.0, 0.0, 0.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.paused
    assert game.tick(STEP_MS, Button.PAUSE, 0.0, 0.0, 0.0, 0.0) == 1
    assert not game.paused
    assert flags(game) == 0


def test_holding_pause_does_not_toggle_again_paused() -> None:
    game = Game()
    game.tick(STEP_MS, Button.PAUSE, 0.0, 0.0, 0.0, 0.0)
    for _ in range(5):
        game.tick(STEP_MS, Button.PAUSE, 0.0, 0.0, 0.0, 0.0)
    assert game.paused


def test_a_still_held_pause_bit_does_not_retoggle_after_resume_resume() -> None:
    game = Game()
    game.tick(STEP_MS, Button.PAUSE, 0.0, 0.0, 0.0, 0.0)
    game.set_paused(False)  # JS resumed while the key was still down
    assert game.tick(STEP_MS, Button.PAUSE, 0.0, 0.0, 0.0, 0.0) == 1
    assert not game.paused


def test_pausing_from_js_while_pause_is_held_does_not_unpause_paused() -> None:
    game = Game()
    game.tick(STEP_MS, Button.PAUSE, 0.0, 0.0, 0.0, 0.0)  # Escape: pause
    game.set_paused(False)
    game.set_paused(True)  # a blur while Escape is still down
    game.tick(STEP_MS, Button.PAUSE, 0.0, 0.0, 0.0, 0.0)
    assert game.paused
