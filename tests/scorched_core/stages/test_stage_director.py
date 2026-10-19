import pytest

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.paths.path_library import path_index
from scorched_core.patterns.pattern_library import pattern_index
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import PLAYFIELD_H
from scorched_core.stages.ground_entry import GroundEntry
from scorched_core.stages.stage_data import StageData
from scorched_core.stages.stage_director import StageDirector
from scorched_core.stages.wave_entry import WaveEntry
from scorched_core.tuning import (
    ENEMY_MAX_ALIVE,
    GROUND_SCROLL_RATIO,
    GROUND_Y0,
    SCROLL_SPEED,
)


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


def test_a_wave_pattern_name_is_resolved_to_an_index_when_the_director_is_built() -> None:
    named = WaveEntry(at=1.0, kind=EnemyKind.JET, x=60.0, pattern="spread3")
    director = StageDirector(stage_of(named, jet(2.0)))
    assert director._patterns == (pattern_index("spread3"), None)


def test_a_named_pattern_reaches_the_spawned_row() -> None:
    named = WaveEntry(at=1.0, kind=EnemyKind.JET, x=60.0, pattern="ring10_slow")
    director, enemies = StageDirector(stage_of(named)), EnemyPool()
    director.step(1.0, enemies)
    assert enemies.pattern[0] == pattern_index("ring10_slow")


def test_a_wave_without_a_pattern_takes_the_kind_default() -> None:
    director, enemies = StageDirector(stage_of(jet(1.0))), EnemyPool()
    director.step(1.0, enemies)
    assert enemies.pattern[0] == pattern_index("jet_aimed")


def path_jet(at: float, name: str = "swoop", *, mirror: bool = False) -> WaveEntry:
    return WaveEntry(
        at=at, kind=EnemyKind.JET, x=20.0, motion=MotionKind.PATH, path=name, mirror=mirror
    )


def test_a_wave_path_name_is_resolved_to_an_index_when_the_director_is_built() -> None:
    director = StageDirector(stage_of(path_jet(1.0, "s_dive"), jet(2.0)))
    assert director._paths == (path_index("s_dive"), -1)


def test_a_path_wave_reaches_the_spawned_row_with_its_index_and_a_forward_flip() -> None:
    director, enemies = StageDirector(stage_of(path_jet(1.0, "loop_back"))), EnemyPool()
    director.step(1.0, enemies)
    assert enemies.motion[0] == MotionKind.PATH
    assert enemies.path[0] == path_index("loop_back")
    assert enemies.flip[0] == 1


def test_a_mirrored_wave_spawns_with_a_flip_of_minus_one() -> None:
    director, enemies = StageDirector(stage_of(path_jet(1.0, mirror=True))), EnemyPool()
    director.step(1.0, enemies)
    assert enemies.flip[0] == -1


def test_a_wave_without_a_path_spawns_with_no_path() -> None:
    director, enemies = StageDirector(stage_of(jet(1.0))), EnemyPool()
    director.step(1.0, enemies)
    assert enemies.path[0] == -1
    assert enemies.flip[0] == 1


# --- ground entries: terrain-anchored targets (plan 03-15) -------------------------------------


def house(at: float, x: float = 40.0, drop: PickupKind | None = None) -> GroundEntry:
    return GroundEntry(at=at, kind=EnemyKind.HOUSE, x=x, drop=drop)


def ground_stage(*entries: GroundEntry, waves: tuple[WaveEntry, ...] = ()) -> StageData:
    return StageData(number=1, length=2000.0, waves=waves, markers=(), ground=entries)


def test_a_ground_entry_spawns_on_the_first_step_at_or_above_its_distance() -> None:
    director, enemies = StageDirector(ground_stage(house(40.0))), EnemyPool()
    assert run(director, enemies, [39.2, 39.99, 40.0, 40.8]) == [0, 0, 1, 1]


def test_a_ground_entry_spawns_aligned_with_its_scenery_row() -> None:
    director, enemies = StageDirector(ground_stage(house(40.0, x=72.0))), EnemyPool()
    director.step(40.6, enemies)
    assert (enemies.kind[0], enemies.x[0]) == (EnemyKind.HOUSE, 72.0)
    assert enemies.y[0] == pytest.approx(GROUND_Y0 + GROUND_SCROLL_RATIO * 0.6)


def test_a_late_ground_entry_spawns_further_down_by_the_distance_it_is_behind() -> None:
    director, enemies = StageDirector(ground_stage(house(40.0))), EnemyPool()
    director.step(140.0, enemies)
    assert enemies.y[0] == pytest.approx(GROUND_Y0 + GROUND_SCROLL_RATIO * 100.0)


def test_a_ground_row_is_terrain_anchored_with_no_velocity_and_carries_its_drop() -> None:
    director, enemies = StageDirector(ground_stage(house(5.0, drop=PickupKind.MEDAL))), EnemyPool()
    director.step(5.0, enemies)
    assert enemies.motion[0] == MotionKind.GROUND
    assert (enemies.vx[0], enemies.vy[0]) == (0.0, 0.0)
    assert enemies.drop[0] == PickupKind.MEDAL
    assert enemies.pattern[0] == -1  # a building never fires


def test_a_ground_entry_without_a_drop_spawns_with_no_drop() -> None:
    director, enemies = StageDirector(ground_stage(house(5.0))), EnemyPool()
    director.step(5.0, enemies)
    assert enemies.drop[0] == -1


def test_step_counts_waves_and_ground_entries_together() -> None:
    stage = ground_stage(house(5.0), house(6.0), waves=(jet(5.0),))
    director, enemies = StageDirector(stage), EnemyPool()
    assert director.step(9.0, enemies) == 3
    assert enemies.n == 3


def test_a_refused_ground_spawn_is_skipped_never_retried() -> None:
    director, enemies = StageDirector(ground_stage(house(5.0))), EnemyPool()
    for _ in range(ENEMY_MAX_ALIVE):
        enemies.spawn(EnemyKind.JET, 0.0, 0.0, MotionKind.SWAY, 0.0, 0.0)
    assert director.step(5.0, enemies) == 0
    enemies.n = 0
    assert director.step(9.0, enemies) == 0
    assert enemies.n == 0


def test_the_ground_cursor_advances_independently_of_the_wave_cursor() -> None:
    director = StageDirector(ground_stage(house(50.0), waves=(jet(10.0), jet(20.0))))
    director.step(30.0, EnemyPool())
    assert (director.cursor, director.ground_cursor) == (2, 0)
    director.step(60.0, EnemyPool())
    assert (director.cursor, director.ground_cursor) == (2, 1)


def test_reset_rewinds_both_cursors() -> None:
    director = StageDirector(ground_stage(house(5.0), waves=(jet(5.0),)))
    director.step(9.0, EnemyPool())
    director.reset()
    assert (director.cursor, director.ground_cursor) == (0, 0)


def test_jump_moves_the_wave_cursor_past_the_distance() -> None:
    director = StageDirector(ground_stage(waves=(jet(2.0), jet(5.0), jet(8.0))))
    director.jump(5.0)
    assert director.cursor == 2


def test_jump_keeps_the_ground_entries_that_are_still_on_screen() -> None:
    # An entry is on screen from y = GROUND_Y0 down to the bottom edge, so it is kept for as long
    # as the scroll is less than this far past its distance.
    visible = (PLAYFIELD_H - GROUND_Y0) / GROUND_SCROLL_RATIO
    director = StageDirector(ground_stage(house(100.0), house(500.0), house(900.0)))
    director.jump(500.0 + visible - 1.0)
    assert director.ground_cursor == 1
    enemies = EnemyPool()
    assert director.step(500.0 + visible - 1.0, enemies) == 1
    assert enemies.y[0] == pytest.approx(PLAYFIELD_H - GROUND_SCROLL_RATIO)


def test_jump_skips_the_ground_entries_already_scrolled_off_the_bottom() -> None:
    visible = (PLAYFIELD_H - GROUND_Y0) / GROUND_SCROLL_RATIO
    director = StageDirector(ground_stage(house(100.0), house(500.0)))
    director.jump(500.0 + visible + 1.0)
    assert director.ground_cursor == 2


def test_jump_to_the_start_rewinds_the_ground_cursor() -> None:
    director = StageDirector(ground_stage(house(5.0)))
    director.step(9.0, EnemyPool())
    director.jump(0.0)
    assert director.ground_cursor == 0
