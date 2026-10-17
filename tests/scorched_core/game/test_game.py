import pytest

from scorched_core.clock.fixed_step_runner import STEP_MS
from scorched_core.game.game import Game
from scorched_core.protocol import (
    DRONE_CAP,
    DRONE_STRIDE,
    EBULLET_STRIDE,
    H_ALPHA,
    H_SHIP_X,
    H_SHIP_Y,
    H_STEPS,
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
