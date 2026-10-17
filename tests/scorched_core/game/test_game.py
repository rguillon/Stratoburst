import sys

import pytest

from scorched_core.clock.fixed_step_runner import STEP_MS
from scorched_core.game.game import Game
from scorched_core.protocol import (
    DRONE_CAP,
    DRONE_STRIDE,
    EBULLET_STRIDE,
    H_ALPHA,
    H_EBULLET_N,
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
