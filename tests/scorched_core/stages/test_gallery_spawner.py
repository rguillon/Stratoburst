import pytest

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.stages.gallery_spawner import GallerySpawner, ScriptEntry
from scorched_core.tuning import GALLERY_LOOP_TICKS, GALLERY_SCRIPT


def run(spawner: GallerySpawner, enemies: EnemyPool, ticks: int) -> list[int]:
    """Step the spawner and return the alive count after every tick."""
    counts = []
    for _ in range(ticks):
        spawner.step(enemies)
        counts.append(enemies.n)
    return counts


def test_the_first_jet_spawns_on_tick_thirty_nine_above_the_top_edge() -> None:
    spawner, enemies = GallerySpawner(), EnemyPool()
    counts = run(spawner, enemies, 40)
    assert counts[38] == 0
    assert counts[39] == 1
    assert (enemies.kind[0], enemies.x[0], enemies.y[0]) == (EnemyKind.JET, 60.0, -12.0)
    assert enemies.vy[0] == pytest.approx(0.9)


def test_a_jet_spawns_every_forty_ticks() -> None:
    spawner, enemies = GallerySpawner(), EnemyPool()
    counts = run(spawner, enemies, 160)
    assert [counts[t] for t in (39, 79, 119, 159)] == [1, 2, 3, 4]


def test_entries_spawn_on_exactly_their_script_tick() -> None:
    script: tuple[ScriptEntry, ...] = (
        (3, EnemyKind.TANK, 50.0, -12.0, 0.0, 0.5, 2),
        (3, EnemyKind.TURRET, 90.0, -12.0, 0.0, 0.5, -1),
        (6, EnemyKind.HELI, 70.0, -12.0, 0.0, 0.5, -1),
    )
    spawner, enemies = GallerySpawner(script=script, loop_ticks=10), EnemyPool()
    assert run(spawner, enemies, 7) == [0, 0, 0, 2, 2, 2, 3]
    assert enemies.drop[0] == 2


def test_the_script_restarts_at_tick_zero_after_the_loop() -> None:
    script: tuple[ScriptEntry, ...] = ((1, EnemyKind.JET, 50.0, -12.0, 0.0, 0.0, -1),)
    spawner, enemies = GallerySpawner(script=script, loop_ticks=4), EnemyPool()
    assert run(spawner, enemies, 9) == [0, 1, 1, 1, 1, 2, 2, 2, 2]
    assert spawner.t == 1


def test_the_default_script_loops_back_to_its_first_jet() -> None:
    spawner, enemies = GallerySpawner(), EnemyPool()
    run(spawner, enemies, GALLERY_LOOP_TICKS)
    assert enemies.n == len(GALLERY_SCRIPT)
    assert (spawner.t, spawner.cursor) == (0, 0)
    spawner.step(enemies)
    assert enemies.n == len(GALLERY_SCRIPT)  # tick 0 spawns nothing
    run(spawner, enemies, 38)
    spawner.step(enemies)
    assert enemies.n == len(GALLERY_SCRIPT) + 1


def test_a_refused_spawn_is_skipped_never_queued() -> None:
    script: tuple[ScriptEntry, ...] = ((0, EnemyKind.JET, 50.0, -12.0, 0.0, 0.0, -1),)
    spawner, enemies = GallerySpawner(script=script, loop_ticks=2), EnemyPool()
    for _ in range(200):
        spawner.step(enemies)
    assert enemies.n == 40
    enemies.n = 0
    spawner.step(enemies)  # tick 0 of a fresh loop spawns again
    assert enemies.n == 1


def test_the_default_gallery_has_ten_jets_per_loop() -> None:
    assert len(GALLERY_SCRIPT) == 10
    assert {entry[1] for entry in GALLERY_SCRIPT} == {EnemyKind.JET}
