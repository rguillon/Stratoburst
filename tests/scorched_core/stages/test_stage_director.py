import pytest

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.stages.stage_data import StageData
from scorched_core.stages.stage_director import StageDirector
from scorched_core.stages.wave_entry import WaveEntry
from scorched_core.tuning import ENEMY_MAX_ALIVE, SCROLL_SPEED


def stage_of(*waves: WaveEntry, length: float = 1000.0) -> StageData:
    return StageData(number=1, length=length, waves=waves, markers=())


def jet(at: float, x: float = 120.0) -> WaveEntry:
    return WaveEntry(at=at, kind=EnemyKind.JET, x=x)


def run(director: StageDirector, enemies: EnemyPool, distances: list[float]) -> list[int]:
    """Step the director at each distance and return the alive count after every step."""
    counts = []
    for distance in distances:
        director.step(distance, enemies)
        counts.append(enemies.n)
    return counts


def test_an_entry_spawns_on_the_first_step_at_or_above_its_distance() -> None:
    director, enemies = StageDirector(stage_of(jet(4.0))), EnemyPool()
    assert run(director, enemies, [3.9, 3.99, 4.0, 4.1]) == [0, 0, 1, 1]


def test_an_accumulated_float_distance_never_skips_or_fires_early() -> None:
    director, enemies = StageDirector(stage_of(jet(4.0))), EnemyPool()
    distance = 0.0
    first_spawn = None
    for step in range(1, 20):
        distance += SCROLL_SPEED
        if director.step(distance, enemies):
            first_spawn = (step, distance)
            break
    assert first_spawn is not None
    step, at_spawn = first_spawn
    assert at_spawn >= 4.0
    assert at_spawn - SCROLL_SPEED < 4.0  # the previous step was still short of it
    assert step in (5, 6)  # 5 * 0.8 is within a float rounding error of 4.0


def test_a_big_jump_in_distance_spawns_everything_passed_in_order() -> None:
    director = StageDirector(stage_of(jet(1.0, x=10.0), jet(2.0, x=20.0), jet(3.0, x=30.0)))
    enemies = EnemyPool()
    assert director.step(50.0, enemies) == 3
    assert [enemies.x[i] for i in range(3)] == [10.0, 20.0, 30.0]


def test_step_returns_how_many_entries_spawned() -> None:
    director, enemies = StageDirector(stage_of(jet(1.0), jet(1.0), jet(5.0))), EnemyPool()
    assert director.step(0.5, enemies) == 0
    assert director.step(1.0, enemies) == 2
    assert director.step(1.5, enemies) == 0
    assert director.step(9.0, enemies) == 1


def test_entries_sharing_an_at_spawn_on_the_same_step_in_declared_order() -> None:
    first = WaveEntry(at=10.0, kind=EnemyKind.JET, x=50.0)
    second = WaveEntry(at=10.0, kind=EnemyKind.HELI, x=150.0)
    director, enemies = StageDirector(stage_of(first, second)), EnemyPool()
    assert run(director, enemies, [9.0, 10.0]) == [0, 2]
    assert (enemies.kind[0], enemies.kind[1]) == (EnemyKind.JET, EnemyKind.HELI)
    assert (enemies.x[0], enemies.x[1]) == (50.0, 150.0)


def test_the_spawned_row_carries_the_entry_fields() -> None:
    wave = WaveEntry(
        at=0.0,
        kind=EnemyKind.CARRIER,
        x=70.0,
        y=-18.0,
        motion=MotionKind.SWAY,
        vx=0.0,
        vy=0.5,
        drop=PickupKind.CRYSTAL,
    )
    director, enemies = StageDirector(stage_of(wave)), EnemyPool()
    director.step(0.0, enemies)
    assert (enemies.kind[0], enemies.x[0], enemies.y[0]) == (EnemyKind.CARRIER, 70.0, -18.0)
    assert enemies.motion[0] == MotionKind.SWAY
    assert (enemies.vx[0], enemies.vy[0]) == (0.0, pytest.approx(0.5))
    assert enemies.drop[0] == PickupKind.CRYSTAL


def test_an_entry_without_a_drop_spawns_with_no_drop() -> None:
    director, enemies = StageDirector(stage_of(jet(0.0))), EnemyPool()
    director.step(0.0, enemies)
    assert enemies.drop[0] == -1


def test_a_refused_spawn_is_skipped_never_retried() -> None:
    director, enemies = StageDirector(stage_of(jet(5.0))), EnemyPool()
    for _ in range(ENEMY_MAX_ALIVE):
        enemies.spawn(EnemyKind.JET, 0.0, 0.0, MotionKind.SWAY, 0.0, 0.0)
    assert director.step(5.0, enemies) == 0  # the pool is full: nothing spawns
    assert enemies.n == ENEMY_MAX_ALIVE
    enemies.n = 0  # room is made, but the refused entry is gone for good
    assert director.step(9.0, enemies) == 0
    assert enemies.n == 0


def test_reset_returns_the_cursor_to_the_start() -> None:
    director, enemies = StageDirector(stage_of(jet(1.0), jet(2.0))), EnemyPool()
    assert director.step(5.0, enemies) == 2
    assert director.cursor == 2
    director.reset()
    assert director.cursor == 0
    assert director.step(5.0, enemies) == 2


def test_jump_skips_every_entry_at_or_before_the_distance() -> None:
    director = StageDirector(stage_of(jet(2.0), jet(5.0), jet(5.0), jet(8.0)))
    director.jump(5.0)
    assert director.cursor == 3
    enemies = EnemyPool()
    assert director.step(100.0, enemies) == 1


def test_jump_before_everything_keeps_the_whole_timeline() -> None:
    director = StageDirector(stage_of(jet(2.0), jet(5.0)))
    director.step(100.0, EnemyPool())
    director.jump(1.0)
    assert director.cursor == 0
