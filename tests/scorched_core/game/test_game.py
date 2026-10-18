import itertools
import math
import random
import sys
from collections.abc import Callable

import pytest

from scorched_core.clock.fixed_step_runner import STEP_MS
from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.game.fault_mode import FAULT_TICK, FaultMode
from scorched_core.game.game import Game
from scorched_core.input.button import Button
from scorched_core.protocol import (
    EBULLET_GAME_CAP,
    EBULLET_STRIDE,
    ENEMY_CAP,
    ENEMY_STRIDE,
    EV_EXPLOSION,
    EV_HIT,
    EV_PICKUP,
    EV_SHOT,
    EVENT_CAP,
    EVENT_STRIDE,
    FLAG_FIRING,
    FLAG_PAUSED,
    H_ALPHA,
    H_EBULLET_N,
    H_ENEMY_N,
    H_EVENT_DROPPED,
    H_EVENT_N,
    H_FLAGS,
    H_KILLS,
    H_LEVEL,
    H_MAX_BONUS,
    H_MISSILE_N,
    H_PBULLET_N,
    H_PICKUP_N,
    H_SCROLL_Y,
    H_SHIP_X,
    H_SHIP_Y,
    H_STEPS,
    H_STORM_HITS,
    H_STORM_N,
    H_TICK_COUNT,
    H_WEAPON,
    HEADER_LEN,
    MISSILE_CAP,
    MISSILE_STRIDE,
    PBULLET_CAP,
    PBULLET_STRIDE,
    PICKUP_CAP,
    PICKUP_STRIDE,
)
from scorched_core.tuning import (
    ENEMY_MAX_ALIVE,
    GALLERY_LOOP_TICKS,
    SHIP_SPEED,
    SHIP_START_X,
    SHIP_START_Y,
)
from scorched_core.weapons.weapon_kind import WeaponKind


def test_manifest_contract() -> None:
    manifest = Game().manifest()
    assert manifest["protocol"] == 2
    assert manifest["playfield"] == {"w": 240.0, "h": 320.0}
    header = manifest["header"]
    assert header["len"] == HEADER_LEN
    assert header["slots"]["STEPS"] == 0
    assert header["slots"]["SHIP_X"] == H_SHIP_X
    assert header["slots"]["ENEMY_N"] == 8 == H_ENEMY_N
    assert header["slots"]["KILLS"] == 11 == H_KILLS
    assert not {"DRONE_N", "DRONES_DOWN"} & header["slots"].keys()
    assert header["slots"]["EVENT_N"] == 12
    assert header["slots"]["EVENT_DROPPED"] == 13
    assert header["len"] == 48
    assert header["slots"]["WEAPON"] == 16 == H_WEAPON
    assert header["slots"]["LEVEL"] == 17 == H_LEVEL
    assert header["slots"]["PICKUP_N"] == 15 == H_PICKUP_N
    assert header["slots"]["MAX_BONUS"] == 20 == H_MAX_BONUS
    assert header["slots"]["MISSILE_N"] == 19 == H_MISSILE_N
    assert header["slots"]["STORM_N"] == 21 == H_STORM_N
    assert len(header["slots"]) == 20
    assert manifest["weapons"] == {"VULCAN": 0, "LASER": 1, "HOMING": 2}
    assert manifest["outcomes"] == {"RAISED": 0, "SWITCHED": 1, "MAXED": 2, "STOCKED": 3}
    assert manifest["channels"] == {
        "pbullets": {"stride": PBULLET_STRIDE, "cap": PBULLET_CAP},
        "ebullets": {"stride": EBULLET_STRIDE, "cap": 600 + EBULLET_GAME_CAP},
        "enemies": {"stride": ENEMY_STRIDE, "cap": ENEMY_CAP},
        "pickups": {"stride": 4, "cap": 16},
        "missiles": {"stride": MISSILE_STRIDE, "cap": MISSILE_CAP},
        "events": {"stride": 6, "cap": 128},
    }
    assert manifest["pickup_kinds"] == {"RED": 0, "BLUE": 1, "PURPLE": 2, "CRYSTAL": 3, "BOMB": 4}
    assert manifest["flags"] == {"PAUSED": 1, "FIRING": 2}
    assert manifest["enemy_kinds"] == {"JET": 0, "HELI": 1, "CARRIER": 2, "TANK": 3, "TURRET": 4}


def test_manifest_publishes_every_event_id_and_blast_class_by_name() -> None:
    manifest = Game().manifest()
    assert manifest["events"] == {
        "EXPLOSION": 1,
        "HIT": 2,
        "SHOT": 3,
        "PICKUP": 4,
        "ENEMY_FIRE": 5,
        "PLAYER_HIT": 6,
        "PLAYER_DEATH": 7,
        "RESPAWN": 8,
        "BOMB_LAUNCH": 9,
        "BOMB_DETONATE": 10,
        "DEATHBOMB_SAVE": 11,
        "SFX": 12,
    }
    assert manifest["blast"] == {"SMALL": 0, "MEDIUM": 1, "LARGE": 2}


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
    assert Game().manifest()["tuning"] == {
        "scroll_speed": 0.8,
        "hitbox_radius": 2.0,
        "ground_scroll_ratio": 0.94,
        "enemy_ground": [0, 0, 0, 1, 1],
        "enemy_radius": [9.0, 10.0, 14.0, 11.0, 10.0],
    }


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
    assert game.manifest()["channels"]["ebullets"]["cap"] == cap + EBULLET_GAME_CAP


def test_the_enemy_channel_is_named_enemies_and_no_drones_channel_exists() -> None:
    game = Game()
    assert "enemies" in game.buffers
    assert "drones" not in game.buffers
    assert "drones" not in game.manifest()["channels"]


def test_buffer_lengths_and_zero_fill() -> None:
    game = Game(stress=750)
    assert {name: len(buf) for name, buf in game.buffers.items()} == {
        "header": HEADER_LEN,
        "pbullets": PBULLET_STRIDE * PBULLET_CAP,
        "ebullets": EBULLET_STRIDE * (750 + EBULLET_GAME_CAP),
        "enemies": ENEMY_STRIDE * ENEMY_CAP,
        "missiles": MISSILE_STRIDE * MISSILE_CAP,
        "pickups": PICKUP_STRIDE * PICKUP_CAP,
        "events": EVENT_STRIDE * EVENT_CAP,
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


@pytest.mark.parametrize("bad_dt", [-5000.0, float("nan"), float("inf"), float("-inf")])
def test_a_bad_dt_is_no_time_and_never_freezes_or_crashes_the_sim(bad_dt: float) -> None:
    game = Game()
    for _ in range(5):  # enough samples for the refresh estimator to be live
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.tick(bad_dt, 0, 0.0, 0.0, 0.0, 0.0) == 0
    assert game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0) == 1  # the next frame runs normally


def test_no_stress_means_an_empty_storm() -> None:
    game = Game()
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.storm is None
    assert game.storm_pool.n == 0
    assert game.ebullets.n == 0
    assert game.buffers["header"][H_EBULLET_N] == 0
    assert game.buffers["header"][H_STORM_N] == 0


def test_tick_with_no_stress_still_packs_without_error() -> None:
    game = Game()
    for _ in range(5):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert all(v == 0.0 for v in game.buffers["ebullets"])


@pytest.mark.parametrize(("stress", "count"), [(1, 1), (500, 500), (99999, 5000)])
def test_stress_spawns_the_clamped_bullet_count(stress: int, count: int) -> None:
    game = Game(stress=stress)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    header = game.buffers["header"]
    assert game.storm_pool.n == count
    assert game.ebullets.n == 0  # the storm never lands in the gameplay pool
    assert header[H_EBULLET_N] == count
    assert header[H_STORM_N] == count


def test_stress_bullets_are_packed_with_kind_one() -> None:
    game = Game(stress=3)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    ebullets = game.buffers["ebullets"]
    assert [ebullets[3], ebullets[7], ebullets[11], ebullets[15]] == [1.0, 1.0, 1.0, 0.0]
    assert ebullets[0] == game.storm_pool.x[0]


def test_storm_hits_accumulate_in_the_header_and_do_nothing_else() -> None:
    game = Game(stress=1)
    game.storm_pool.x[0] = game.ship.x
    game.storm_pool.y[0] = game.ship.y
    game.storm_pool.vx[0] = 0.0
    game.storm_pool.vy[0] = 0.0
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
    # Warm up pools and caches through two gallery loops, so a crystal has been dropped, has
    # bounced, expired and drifted away before the measured window starts.
    for _ in range(2 * GALLERY_LOOP_TICKS):
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


def test_a_new_game_starts_with_the_vulcan_at_level_one() -> None:
    game = Game()
    assert game.loadout.kind is WeaponKind.VULCAN
    assert game.loadout.level == 1
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["header"][H_WEAPON] == 0
    assert game.buffers["header"][H_LEVEL] == 1


@pytest.mark.parametrize(("asked", "expected"), [(0, 1), (-3, 1), (1, 1), (5, 5), (9, 5)])
def test_the_starting_level_is_clamped_to_one_to_five(asked: int, expected: int) -> None:
    assert Game(level=asked).loadout.level == expected


def test_a_level_five_game_fires_the_seven_stream_fan() -> None:
    game = Game(level=5)
    _hold_fire(game, 1)
    assert game.pbullets.n == 7
    assert game.buffers["header"][H_LEVEL] == 5


def test_a_level_five_game_fires_every_four_steps() -> None:
    game = Game(level=5)
    _hold_fire(game, 12)  # volleys at steps 0, 4 and 8
    assert game.pbullets.n == 21


def test_a_firing_vulcan_pushes_one_shot_event_per_volley() -> None:
    game = Game()
    _hold_fire(game, 1)
    assert game.events.n == 1
    assert game.events.buf[0] == EV_SHOT
    assert game.events.buf[3] == WeaponKind.VULCAN


def test_a_laser_or_homing_loadout_fires_no_bolts() -> None:
    for weapon in (WeaponKind.LASER, WeaponKind.HOMING):
        game = Game(weapon=weapon, level=3)
        _hold_fire(game, 30)
        assert game.pbullets.n == 0
        assert game.buffers["header"][H_WEAPON] == weapon
        assert game.buffers["header"][H_LEVEL] == 3


def test_the_missiles_channel_is_four_floats_by_forty_eight_and_matches_the_manifest() -> None:
    game = Game()
    assert MISSILE_STRIDE == 4
    assert MISSILE_CAP == 48
    assert len(game.buffers["missiles"]) == MISSILE_STRIDE * MISSILE_CAP


def test_a_homing_loadout_launches_a_missile_and_packs_it_with_the_header_count() -> None:
    game = Game(weapon=WeaponKind.HOMING)
    _hold_fire(game, 1)
    assert game.missiles.n == 1
    assert game.buffers["header"][H_MISSILE_N] == 1
    x, y, angle, life = game.buffers["missiles"][:4]
    assert x == game.ship.x
    assert y < game.ship.y
    assert (angle, life) == (0.0, pytest.approx(1 / 90))
    assert game.events.buf[0] == EV_SHOT
    assert game.events.buf[3] == WeaponKind.HOMING


def test_the_vulcan_launches_no_missiles() -> None:
    game = Game()
    _hold_fire(game, 30)
    assert game.missiles.n == 0
    assert game.buffers["header"][H_MISSILE_N] == 0


def test_switching_to_homing_only_launches_with_fire_held() -> None:
    game = Game(weapon=WeaponKind.HOMING, level=3)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.missiles.n == 0
    _hold_fire(game, 1)
    assert game.missiles.n == 3


def test_a_scripted_homing_run_curves_missiles_onto_enemies_and_damages_them() -> None:
    game = Game(weapon=WeaponKind.HOMING, level=3)
    flashed = False
    peak_heading = 0.0
    for _ in range(240):
        game.tick(STEP_MS, Button.FIRE, 0.0, 0.0, 0.0, 0.0)
        flashed = flashed or any(game.enemies.flash[i] > 0 for i in range(game.enemies.n))
        peak_heading = max(
            [peak_heading, *(abs(game.missiles.angle[i]) for i in range(game.missiles.n))]
        )
    assert flashed or game.enemies.kills > 0  # a missile reached an enemy
    assert game.pbullets.n == 0  # purple has no forward shot
    assert peak_heading > math.radians(5.0)  # a missile curved beyond its launch angle
    assert all(math.isfinite(v) for v in game.buffers["missiles"])
    assert game.buffers["header"][H_MISSILE_N] == game.missiles.n


def test_the_header_follows_the_loadout_when_it_changes() -> None:
    game = Game()
    game.loadout.kind = WeaponKind.HOMING
    game.loadout.level = 4
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["header"][H_WEAPON] == WeaponKind.HOMING
    assert game.buffers["header"][H_LEVEL] == 4


def test_switching_away_from_the_vulcan_stops_the_bolts_while_its_cooldown_keeps_counting() -> None:
    game = Game()
    _hold_fire(game, 1)  # volley at step 0: cooldown 4 left
    assert game.vulcan.cooldown == 4
    game.loadout.kind = WeaponKind.LASER
    _hold_fire(game, 4)
    assert game.vulcan.cooldown == 0
    assert game.events.n == 0
    bolts = game.pbullets.n
    _hold_fire(game, 5)
    assert game.pbullets.n <= bolts  # nothing new was spawned


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


def _track_lowest_enemy_and_fire(game: Game, ticks: int) -> None:
    """A scripted pilot: steer under the lowest enemy and keep fire held."""
    enemies = game.enemies
    for _ in range(ticks):
        move_x = 0.0
        if enemies.n:
            lowest = max(range(enemies.n), key=lambda i: enemies.y[i])
            dx = enemies.x[lowest] - game.ship.x
            move_x = 0.0 if abs(dx) < 2.0 else (1.0 if dx > 0 else -1.0)
        game.tick(STEP_MS, Button.FIRE, move_x, 0.0, 0.0, 0.0)


def test_the_header_counts_enemies_from_step_thirty_one_on() -> None:
    game = Game()
    for _ in range(30):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["header"][H_ENEMY_N] == 0
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["header"][H_ENEMY_N] == 1
    assert game.buffers["header"][H_KILLS] == 0


def test_enemies_are_packed_into_the_enemies_channel() -> None:
    game = Game()
    for _ in range(40):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    packed = game.buffers["enemies"]
    assert packed[0] == game.enemies.x[0]
    assert packed[1] == game.enemies.y[0]
    assert packed[5] == float(EnemyKind.JET)


def test_a_zero_step_tick_keeps_the_enemy_buffer_but_reports_the_count() -> None:
    game = Game()
    for _ in range(40):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    before = game.buffers["enemies"].tobytes()
    game.tick(STEP_MS / 2, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["enemies"].tobytes() == before
    assert game.buffers["header"][H_ENEMY_N] == 1


def _park_one_enemy(game: Game, hp: int, kind: EnemyKind = EnemyKind.JET) -> None:
    """Replace the gallery's population with one stationary enemy above the ship's bolts."""
    enemies = game.enemies
    enemies.n = 0
    enemies.spawn(kind, game.ship.x, game.ship.y - 40.0, MotionKind.SWAY, 0.0, 0.0)
    enemies.hp[0] = hp


def test_a_bolt_that_reaches_an_enemy_costs_it_a_hit_through_the_game_step() -> None:
    game = Game()
    _park_one_enemy(game, 3)
    game.pbullets.spawn(game.ship.x, game.ship.y - 30.0, 0.0, -8.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.enemies.hp[0] == 2
    assert game.pbullets.n == 0


def test_kills_count_destroyed_enemies_in_the_header() -> None:
    game = Game()
    _park_one_enemy(game, 1)
    game.pbullets.spawn(game.ship.x, game.ship.y - 30.0, 0.0, -8.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["header"][H_ENEMY_N] == 0
    assert game.buffers["header"][H_KILLS] == 1


def test_the_same_seed_and_inputs_give_byte_identical_buffers_determinism() -> None:
    def run(seed: int, pilot: Callable[[Game, int], None]) -> tuple[bytes, ...]:
        game = Game(seed=seed)
        pilot(game, 600)
        return tuple(game.buffers[name].tobytes() for name in ("header", "pbullets", "enemies"))

    assert run(11, _sweep_and_fire) == run(11, _sweep_and_fire)
    assert run(11, _sweep_and_fire) == run(12, _sweep_and_fire)  # the gallery is scripted
    assert run(11, _sweep_and_fire) != run(11, _track_lowest_enemy_and_fire)


def test_scripted_kill_ship_tracking_the_lowest_enemy_downs_three_within_1200_ticks() -> None:
    game = Game()
    _track_lowest_enemy_and_fire(game, 1200)
    assert game.buffers["header"][H_KILLS] >= 3
    assert game.enemies.kills == game.buffers["header"][H_KILLS]


def test_live_enemies_never_exceed_the_alive_cap_over_two_loops() -> None:
    game = Game()
    peak = 0
    for _ in range(2 * GALLERY_LOOP_TICKS):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
        peak = max(peak, game.enemies.n)
    assert 0 < peak <= ENEMY_MAX_ALIVE < ENEMY_CAP


def test_a_flooded_gallery_refuses_spawns_instead_of_growing() -> None:
    game = Game()
    for _ in range(ENEMY_MAX_ALIVE):
        game.enemies.spawn(EnemyKind.TURRET, 120.0, 10.0, MotionKind.SWAY, 0.0, 0.0)
    for _ in range(GALLERY_LOOP_TICKS):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.enemies.n == ENEMY_MAX_ALIVE
    assert len(game.buffers["enemies"]) == ENEMY_STRIDE * ENEMY_CAP


def test_overkill_two_bolts_on_one_enemy_give_one_explosion_and_one_kill() -> None:
    game = Game()
    x, y = game.ship.x, game.ship.y - 40.0
    game.enemies.n = 0
    game.enemies.spawn(EnemyKind.JET, x, y, MotionKind.SWAY, 0.0, 0.0)
    game.enemies.hp[0] = 1
    game.pbullets.spawn(x, y + 10.0, 0.0, -8.0)
    game.pbullets.spawn(x + 1.0, y + 10.0, 0.0, -8.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["header"][H_KILLS] == 1
    assert game.buffers["header"][H_EVENT_N] == 1
    assert game.buffers["events"][0] == EV_EXPLOSION
    assert game.pbullets.n == 1  # the dead enemy absorbed only the first bolt


def test_a_kill_publishes_its_blast_class_ground_flag_and_kind() -> None:
    game = Game()
    x, y = game.ship.x, game.ship.y - 40.0
    game.enemies.n = 0
    game.enemies.spawn(EnemyKind.TANK, x, y, MotionKind.SWAY, 0.0, 0.0)
    game.enemies.hp[0] = 1
    game.pbullets.spawn(x, y + 10.0, 0.0, -8.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    events = game.buffers["events"]
    assert (events[3], events[4], events[5]) == (2.0, 1.0, float(EnemyKind.TANK))


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


def _run_ticks(game: Game, count: int) -> None:
    for _ in range(count):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)


def test_a_game_injects_no_fault_by_default() -> None:
    assert Game().fault is FaultMode.NONE


def test_the_python_fault_waits_for_step_120_and_not_119_fault() -> None:
    game = Game(fault=FaultMode.PY)
    _run_ticks(game, FAULT_TICK - 1)
    assert game.tick_count == FAULT_TICK - 1
    with pytest.raises(RuntimeError, match=r"Injected Python fault \(\?crash=py\) at tick 120"):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.tick_count == FAULT_TICK


@pytest.mark.parametrize("fault", [FaultMode.NONE, FaultMode.JS])
def test_only_the_python_fault_mode_raises_in_the_simulation_fault(fault: FaultMode) -> None:
    game = Game(fault=fault)
    _run_ticks(game, 300)
    assert game.tick_count == 300


def _kill_one_enemy(game: Game, x: float, y: float) -> None:
    """Park a one-hp jet just above a bolt that reaches it on the next step."""
    enemies = game.enemies
    enemies.n = 0
    enemies.spawn(EnemyKind.JET, x, y, MotionKind.SWAY, 0.0, 0.0)
    enemies.hp[0] = 1
    game.pbullets.spawn(x, y + 10.0, 0.0, -8.0)


def test_a_kill_publishes_one_explosion_through_the_events_channel() -> None:
    game = Game()
    _kill_one_enemy(game, game.ship.x, game.ship.y - 40.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    events = game.buffers["events"]
    assert game.buffers["header"][H_EVENT_N] == 1
    assert events[0] == EV_EXPLOSION
    assert events[1] == pytest.approx(game.ship.x, abs=5.0)  # the jet swayed one step
    assert events[2] == pytest.approx(game.ship.y - 40.0, abs=2.0)
    assert events[3] == 0.0  # BLAST_SMALL
    assert game.buffers["header"][H_EVENT_DROPPED] == 0


def test_event_n_resets_on_a_zero_step_tick_after_an_event_tick() -> None:
    game = Game()
    _kill_one_enemy(game, game.ship.x, game.ship.y - 40.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["header"][H_EVENT_N] == 1
    assert game.tick(0.0, 0, 0.0, 0.0, 0.0, 0.0) == 0
    assert game.buffers["header"][H_EVENT_N] == 0


def test_event_n_resets_on_a_paused_tick_after_an_event_tick() -> None:
    game = Game()
    _kill_one_enemy(game, game.ship.x, game.ship.y - 40.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["header"][H_EVENT_N] == 1
    game.tick(STEP_MS, Button.PAUSE, 0.0, 0.0, 0.0, 0.0)
    assert game.paused
    assert game.buffers["header"][H_EVENT_N] == 0


def test_event_n_resets_on_a_following_step_tick_with_no_new_event() -> None:
    game = Game()
    _kill_one_enemy(game, game.ship.x, game.ship.y - 40.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["header"][H_EVENT_N] == 0


def test_event_dropped_is_cumulative_across_ticks() -> None:
    game = Game()
    game.events.dropped = 5
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["header"][H_EVENT_DROPPED] == 5


def test_a_hit_that_does_not_kill_publishes_one_hit_event() -> None:
    game = Game()
    _park_one_enemy(game, 3)
    game.pbullets.spawn(game.ship.x, game.ship.y - 30.0, 0.0, -8.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["header"][H_EVENT_N] == 1
    assert game.buffers["events"][0] == EV_HIT


def test_the_manifest_exports_the_ground_scroll_ratio_and_per_kind_radii() -> None:
    tuning = Game().manifest()["tuning"]
    assert tuning["ground_scroll_ratio"] == 0.94
    assert tuning["enemy_ground"] == [0, 0, 0, 1, 1]
    assert tuning["enemy_radius"] == [9.0, 10.0, 14.0, 11.0, 10.0]


def test_a_ground_tank_scrolls_with_the_terrain_through_the_game_step() -> None:
    game = Game()
    game.enemies.n = 0
    game.enemies.spawn(EnemyKind.TANK, 100.0, 20.0, MotionKind.GROUND, 0.0, 0.0)
    for _ in range(10):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.enemies.y[0] == pytest.approx(20.0 + 10 * 0.752, abs=1e-4)


def test_a_turret_aims_at_the_ship_through_the_game_step() -> None:
    game = Game()
    game.enemies.n = 0
    game.enemies.spawn(EnemyKind.TURRET, game.ship.x + 60.0, 20.0, MotionKind.GROUND, 0.0, 0.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    expected = math.atan2(game.ship.x - game.enemies.x[0], game.ship.y - game.enemies.y[0])
    assert game.enemies.aux[0] == pytest.approx(expected, abs=1e-5)
    assert game.buffers["enemies"][6] == game.enemies.aux[0]
    assert game.enemies.aux[0] < 0.0


# --- carrier drops and crystal pickups (plan 02-10) -----------------------------------------


def _kill_carrier(game: Game, x: float, y: float, drop: int = PickupKind.CRYSTAL) -> None:
    """Park a one-hp carrier carrying ``drop`` just above a bolt that reaches it next step."""
    enemies = game.enemies
    enemies.n = 0
    enemies.spawn(EnemyKind.CARRIER, x, y, MotionKind.SWAY, 0.0, 0.0, drop)
    enemies.hp[0] = 1
    game.pbullets.spawn(x, y + 10.0, 0.0, -8.0)


def _tick(game: Game) -> None:
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)


def test_a_killed_carrier_drops_one_crystal_at_its_kill_position() -> None:
    game = Game()
    _kill_carrier(game, 120.0, 80.0)
    _tick(game)
    pickups = game.pickups
    assert pickups.n == 1
    assert pickups.kind[0] == PickupKind.CRYSTAL
    assert pickups.x[0] == pytest.approx(120.0, abs=3.0)  # the carrier swayed one step
    assert pickups.y[0] == pytest.approx(80.0, abs=1.0)  # then the crystal was launched upward
    assert game.buffers["header"][H_PICKUP_N] == 1


def test_a_killed_enemy_without_a_drop_leaves_no_pickup() -> None:
    game = Game()
    _kill_carrier(game, 120.0, 80.0, drop=-1)
    _tick(game)
    assert game.buffers["header"][H_KILLS] == 1
    assert game.pickups.n == 0
    assert game.buffers["header"][H_PICKUP_N] == 0


def test_the_pickups_channel_carries_position_colour_and_kind() -> None:
    game = Game()
    _kill_carrier(game, 120.0, 80.0)
    _tick(game)
    out = game.buffers["pickups"]
    assert out[0] == pytest.approx(game.pickups.x[0])
    assert out[1] == pytest.approx(game.pickups.y[0])
    assert (out[2], out[3]) == (0.0, float(PickupKind.CRYSTAL))


def test_a_zero_step_tick_keeps_the_pickups_buffer_but_reports_the_count() -> None:
    game = Game()
    _kill_carrier(game, 120.0, 80.0)
    _tick(game)
    before = game.buffers["pickups"].tobytes()
    game.tick(0.0, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["pickups"].tobytes() == before
    assert game.buffers["header"][H_PICKUP_N] == 1


def _drop_and_stand_on_it(game: Game) -> None:
    """Kill a carrier, then put the ship's centre where the crystal it dropped is."""
    _kill_carrier(game, 120.0, 80.0)
    _tick(game)
    game.ship.x = game.pickups.x[0]
    game.ship.y = game.pickups.y[0]


def test_scripted_catch_a_red_crystal_from_a_carrier_raises_the_vulcan_one_level() -> None:
    game = Game()
    _drop_and_stand_on_it(game)
    _tick(game)
    header = game.buffers["header"]
    assert (header[H_WEAPON], header[H_LEVEL], header[H_PICKUP_N]) == (0.0, 2.0, 0.0)
    assert header[H_EVENT_N] == 1
    events = game.buffers["events"]
    assert events[0] == EV_PICKUP
    assert events[1] == pytest.approx(game.ship.x, abs=1.0)
    assert events[2] == pytest.approx(game.ship.y, abs=1.0)
    # kind CRYSTAL, outcome RAISED (0), colour index at the catch red (0)
    assert (events[3], events[4], events[5]) == (float(PickupKind.CRYSTAL), 0.0, 0.0)
    assert game.pickups.n == 0


def test_scripted_catch_a_blue_crystal_switches_the_weapon_and_keeps_the_level() -> None:
    game = Game(level=3)
    _drop_and_stand_on_it(game)
    game.pickups.age[0] = 100  # second third of the cycle: blue
    _tick(game)
    header = game.buffers["header"]
    assert (header[H_WEAPON], header[H_LEVEL]) == (float(WeaponKind.LASER), 3.0)
    events = game.buffers["events"]
    assert (events[3], events[4], events[5]) == (float(PickupKind.CRYSTAL), 1.0, 1.0)


def test_a_crystal_far_from_the_ship_is_not_caught() -> None:
    game = Game()
    _kill_carrier(game, 120.0, 80.0)
    _tick(game)
    _tick(game)
    assert game.pickups.n == 1
    assert game.buffers["header"][H_EVENT_N] == 0
    assert game.loadout.level == 1


def test_a_fifth_same_colour_catch_is_counted_as_a_max_bonus() -> None:
    game = Game(level=5)
    _drop_and_stand_on_it(game)
    _tick(game)
    assert game.max_bonus == 1
    assert game.buffers["header"][H_MAX_BONUS] == 1
    assert game.loadout.level == 5
    events = game.buffers["events"]
    assert (events[3], events[4]) == (float(PickupKind.CRYSTAL), 2.0)  # outcome MAXED


def test_raised_and_switched_catches_are_not_max_bonuses_max_bonus() -> None:
    raised = Game(level=4)
    _drop_and_stand_on_it(raised)
    _tick(raised)
    assert raised.loadout.level == 5
    switched = Game(level=5)
    _drop_and_stand_on_it(switched)
    switched.pickups.age[0] = 100
    _tick(switched)
    assert switched.loadout.kind is WeaponKind.LASER
    assert (raised.max_bonus, switched.max_bonus) == (0, 0)
    assert switched.buffers["header"][H_MAX_BONUS] == 0


def test_max_bonus_accumulates_across_catches_max_bonus() -> None:
    game = Game(level=5)
    for _ in range(3):
        _drop_and_stand_on_it(game)
        _tick(game)
    assert game.max_bonus == 3
    _tick(game)
    assert game.buffers["header"][H_MAX_BONUS] == 3


def test_a_flood_of_crystals_never_grows_the_pool_past_its_cap() -> None:
    game = Game()
    for _ in range(PICKUP_CAP + 5):
        game.pickups.spawn_crystal(20.0, 20.0)
    for _ in range(40):
        game.enemies.n = 0
        _kill_carrier(game, 120.0, 80.0)
        _tick(game)
    assert game.pickups.n == PICKUP_CAP


def test_a_gameplay_bullet_moves_by_its_velocity_every_step() -> None:
    game = Game()
    game.ebullets.spawn(100.0, 100.0, 1.5, 2.0)
    game.tick(STEP_MS * 3, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.ebullets.x[0] == pytest.approx(104.5)
    assert game.ebullets.y[0] == pytest.approx(106.0)


@pytest.mark.parametrize(
    ("x", "y", "vx", "vy"),
    [
        (-15.5, 100.0, -1.0, 0.0),
        (255.5, 100.0, 1.0, 0.0),
        (100.0, -15.5, 0.0, -1.0),
        (100.0, 335.5, 0.0, 1.0),
    ],
)
def test_a_gameplay_bullet_is_culled_16_units_outside_the_playfield(
    x: float, y: float, vx: float, vy: float
) -> None:
    game = Game()
    game.ebullets.spawn(x, y, vx, vy)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)  # now exactly 16.5 outside
    assert game.ebullets.n == 0
    assert game.buffers["header"][H_EBULLET_N] == 0


def test_a_gameplay_bullet_just_inside_the_margin_stays() -> None:
    game = Game()
    game.ebullets.spawn(-14.5, 100.0, -1.0, 0.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)  # x == -15.5, inside the 16 unit margin
    assert game.ebullets.n == 1


def test_storm_bullets_keep_bouncing_and_are_never_culled_or_moved_by_the_gameplay_pass() -> None:
    game = Game(stress=50)
    game.ebullets.spawn(100.0, 100.0, 0.0, 0.0)
    for _ in range(120):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.storm_pool.n == 50
    assert all(
        0.0 <= game.storm_pool.x[i] <= 240.0 and 0.0 <= game.storm_pool.y[i] <= 320.0
        for i in range(50)
    )
    assert (game.ebullets.x[0], game.ebullets.y[0]) == (100.0, 100.0)


def test_a_full_storm_plus_gameplay_bullets_pack_in_order_and_fit_the_channel() -> None:
    game = Game(stress=99999)
    for k in range(3):
        game.ebullets.spawn(10.0 + k, 20.0, 0.0, 0.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    header = game.buffers["header"]
    ebullets = game.buffers["ebullets"]
    assert game.storm_pool.n == 5000
    assert header[H_EBULLET_N] == 5003
    assert header[H_STORM_N] == 5000
    assert len(ebullets) == EBULLET_STRIDE * (5000 + EBULLET_GAME_CAP)
    assert ebullets[0] == game.storm_pool.x[0]  # storm first
    last_storm = (5000 - 1) * EBULLET_STRIDE
    assert ebullets[last_storm] == game.storm_pool.x[4999]
    gameplay = [ebullets[(5000 + k) * EBULLET_STRIDE] for k in range(3)]
    assert gameplay == [10.0, 11.0, 12.0]  # gameplay right after the storm
    assert ebullets[(5000 + 3) * EBULLET_STRIDE + 3] == 0.0  # nothing past the live bullets


def test_a_full_gameplay_pool_with_a_full_storm_still_fits_the_channel() -> None:
    game = Game(stress=99999)
    for k in range(EBULLET_GAME_CAP):
        assert game.ebullets.spawn(1.0 + k % 200, 50.0, 0.0, 0.0)
    assert not game.ebullets.spawn(1.0, 1.0, 0.0, 0.0)
    game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.buffers["header"][H_EBULLET_N] == 5000 + EBULLET_GAME_CAP


def test_storm_never_kills_it_only_counts_and_changes_nothing_else() -> None:
    game = Game(stress=1)
    game.storm_pool.x[0] = game.ship.x
    game.storm_pool.y[0] = game.ship.y
    game.storm_pool.vx[0] = 0.0
    game.storm_pool.vy[0] = 0.0
    for _ in range(5):
        game.tick(STEP_MS, 0, 0.0, 0.0, 0.0, 0.0)
    assert game.storm_hits == 5
    assert game.ebullets.n == 0  # the gameplay pool, which later plans make lethal, is untouched
    assert game.storm_pool.n == 1
    assert (game.ship.x, game.ship.y) == (SHIP_START_X, SHIP_START_Y)
    assert game.events.n == 0


def test_a_zero_step_tick_leaves_the_channel_alone_but_reports_both_counts() -> None:
    game = Game(stress=2)
    game.ebullets.spawn(50.0, 50.0, 0.0, 0.0)
    game.tick(STEP_MS / 2, 0, 0.0, 0.0, 0.0, 0.0)
    header = game.buffers["header"]
    assert all(v == 0.0 for v in game.buffers["ebullets"])
    assert header[H_EBULLET_N] == 3
    assert header[H_STORM_N] == 2
