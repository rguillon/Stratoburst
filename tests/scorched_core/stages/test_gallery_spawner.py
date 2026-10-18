import pytest

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import PLAYFIELD_W
from scorched_core.stages.gallery_spawner import GallerySpawner, ScriptEntry
from scorched_core.tuning import (
    ENEMY_EXIT_MARGIN,
    ENEMY_MAX_ALIVE,
    ENEMY_RADIUS,
    ENEMY_SWAY,
    GALLERY_LOOP_TICKS,
    GALLERY_SCRIPT,
    HOVER_HOLD_TICKS,
)


def run(spawner: GallerySpawner, enemies: EnemyPool, ticks: int) -> list[int]:
    """Step the spawner and return the alive count after every tick."""
    counts = []
    for _ in range(ticks):
        spawner.step(enemies)
        counts.append(enemies.n)
    return counts


def test_the_first_v_jet_spawns_on_tick_thirty_above_the_top_edge() -> None:
    spawner, enemies = GallerySpawner(), EnemyPool()
    counts = run(spawner, enemies, 31)
    assert counts[29] == 0
    assert counts[30] == 1
    assert (enemies.kind[0], enemies.x[0], enemies.y[0]) == (EnemyKind.JET, 60.0, -12.0)
    assert enemies.motion[0] == MotionKind.DIVE
    assert (enemies.vx[0], enemies.vy[0]) == (pytest.approx(0.5), pytest.approx(2.2))


def test_the_v_of_three_jets_spawns_twelve_ticks_apart() -> None:
    spawner, enemies = GallerySpawner(), EnemyPool()
    counts = run(spawner, enemies, 55)
    assert [counts[t] for t in (29, 30, 41, 42, 53, 54)] == [0, 1, 1, 2, 2, 3]
    assert sorted(enemies.x[i] for i in range(3)) == [60.0, 120.0, 180.0]


def test_entries_spawn_on_exactly_their_script_tick() -> None:
    script: tuple[ScriptEntry, ...] = (
        (3, EnemyKind.TANK, 50.0, -12.0, MotionKind.SWAY, 0.0, 0.5, 2),
        (3, EnemyKind.TURRET, 90.0, -12.0, MotionKind.SWAY, 0.0, 0.5, -1),
        (6, EnemyKind.HELI, 70.0, -12.0, MotionKind.HOVER, 0.0, 0.5, -1),
    )
    spawner, enemies = GallerySpawner(script=script, loop_ticks=10), EnemyPool()
    assert run(spawner, enemies, 7) == [0, 0, 0, 2, 2, 2, 3]
    assert enemies.drop[0] == 2
    assert [enemies.motion[i] for i in range(3)] == [
        MotionKind.SWAY,
        MotionKind.SWAY,
        MotionKind.HOVER,
    ]


def test_the_script_restarts_at_tick_zero_after_the_loop() -> None:
    script: tuple[ScriptEntry, ...] = (
        (1, EnemyKind.JET, 50.0, -12.0, MotionKind.SWAY, 0.0, 0.0, -1),
    )
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
    run(spawner, enemies, 29)
    spawner.step(enemies)
    assert enemies.n == len(GALLERY_SCRIPT) + 1


def test_a_refused_spawn_is_skipped_never_queued() -> None:
    script: tuple[ScriptEntry, ...] = (
        (0, EnemyKind.JET, 50.0, -12.0, MotionKind.SWAY, 0.0, 0.0, -1),
    )
    spawner, enemies = GallerySpawner(script=script, loop_ticks=2), EnemyPool()
    for _ in range(200):
        spawner.step(enemies)
    assert enemies.n == 40
    enemies.n = 0
    spawner.step(enemies)  # tick 0 of a fresh loop spawns again
    assert enemies.n == 1


def _count(kind: EnemyKind) -> int:
    return sum(1 for entry in GALLERY_SCRIPT if entry[1] == kind)


def test_the_air_loop_is_twelve_hundred_steps_long() -> None:
    assert GALLERY_LOOP_TICKS == 1200


def test_the_air_loop_spawns_at_least_thirteen_jets_three_helicopters_and_two_carriers() -> None:
    assert _count(EnemyKind.JET) >= 13
    assert _count(EnemyKind.HELI) >= 3
    assert _count(EnemyKind.CARRIER) >= 2


def test_helicopters_hover_and_air_units_never_use_the_ground_motion() -> None:
    for _tick, kind, _x, _y, motion, *_rest in GALLERY_SCRIPT:
        if kind == EnemyKind.HELI:
            assert motion == MotionKind.HOVER
        if kind in (EnemyKind.JET, EnemyKind.HELI, EnemyKind.CARRIER):
            assert motion != MotionKind.GROUND


def test_the_loop_spawns_at_least_four_tanks_and_two_turrets_all_on_the_ground_motion() -> None:
    assert _count(EnemyKind.TANK) >= 4
    assert _count(EnemyKind.TURRET) >= 2
    for _tick, kind, _x, _y, motion, *_rest in GALLERY_SCRIPT:
        if kind in (EnemyKind.TANK, EnemyKind.TURRET):
            assert motion == MotionKind.GROUND


def test_ground_entries_start_above_the_field_and_crawl_gently() -> None:
    ground = [e for e in GALLERY_SCRIPT if e[4] == MotionKind.GROUND]
    assert ground
    for _tick, _kind, x, y, _motion, vx, vy, _drop in ground:
        assert y < 0.0
        assert 0.0 < x < PLAYFIELD_W
        assert abs(vx) <= 0.25
        assert vy == 0.0


def test_jets_sweep_in_from_both_sides_and_the_top() -> None:
    dives = [entry for entry in GALLERY_SCRIPT if entry[4] == MotionKind.DIVE]
    assert any(entry[2] < 0.0 and entry[5] > 0.0 for entry in dives)  # left edge, flying right
    assert any(entry[2] > PLAYFIELD_W and entry[5] < 0.0 for entry in dives)  # right edge, left
    assert any(entry[3] < 0.0 and entry[6] > 0.0 for entry in dives)  # from the top


@pytest.mark.parametrize("entry", [e for e in GALLERY_SCRIPT if e[4] == MotionKind.SWAY])
def test_no_sway_entry_can_leave_the_playfield_sideways(entry: ScriptEntry) -> None:
    _tick, kind, x, _y, _motion, vx, *_rest = entry
    reach = ENEMY_SWAY + ENEMY_RADIUS[kind]
    assert vx == 0.0
    assert reach <= x <= PLAYFIELD_W - reach


def test_the_gallery_never_exceeds_the_alive_cap_over_two_loops_and_never_refuses_a_spawn() -> None:
    spawner, enemies = GallerySpawner(), EnemyPool()
    spawned = 0
    peak = 0
    for _ in range(2 * GALLERY_LOOP_TICKS):
        before = enemies.n
        due = _due_now(spawner)
        spawner.step(enemies)
        enemies.step(120.0, 272.0)
        spawned += due
        peak = max(peak, enemies.n)
        assert enemies.n <= before + due
    assert peak <= ENEMY_MAX_ALIVE
    assert enemies._next_uid - 1 == spawned  # every scripted spawn was accepted


def _due_now(spawner: GallerySpawner) -> int:
    script, cursor, due = spawner.script, spawner.cursor, 0
    while cursor < len(script) and script[cursor][0] == spawner.t:
        due += 1
        cursor += 1
    return due


def test_a_hover_helicopter_from_the_script_spawns_on_its_tick_and_hovers() -> None:
    spawner, enemies = GallerySpawner(), EnemyPool()
    run(spawner, enemies, 201)
    heli = next(i for i in range(enemies.n) if enemies.kind[i] == EnemyKind.HELI)
    assert enemies.motion[heli] == MotionKind.HOVER
    assert (enemies.x[heli], enemies.y[heli]) == (80.0, -14.0)
    assert enemies.timer[heli] == HOVER_HOLD_TICKS


def test_script_ticks_are_sorted_and_lie_inside_the_loop() -> None:
    ticks = [entry[0] for entry in GALLERY_SCRIPT]
    assert ticks == sorted(ticks)
    assert all(0 <= tick < GALLERY_LOOP_TICKS for tick in ticks)


def test_script_entries_enter_from_outside_the_visible_field_with_a_known_kind() -> None:
    for _tick, kind, x, y, motion, vx, vy, drop in GALLERY_SCRIPT:
        assert kind in EnemyKind
        from_top = y < 0.0 and (vy > 0.0 or motion == MotionKind.GROUND)
        from_left = x < 0.0 and vx > 0.0
        from_right = x > PLAYFIELD_W and vx < 0.0
        assert from_top or from_left or from_right
        assert -ENEMY_EXIT_MARGIN < x < PLAYFIELD_W + ENEMY_EXIT_MARGIN
        assert drop >= -1


def test_both_aa_turret_entries_carry_a_bomb_drop() -> None:
    turrets = [entry for entry in GALLERY_SCRIPT if entry[1] == EnemyKind.TURRET]
    assert len(turrets) >= 2
    assert all(entry[7] == PickupKind.BOMB for entry in turrets)


def test_only_turrets_and_carriers_drop_anything_and_crystals_stay_on_the_carriers() -> None:
    for _tick, kind, *_rest, drop in GALLERY_SCRIPT:
        if kind == EnemyKind.TURRET:
            assert drop == PickupKind.BOMB
        elif kind == EnemyKind.CARRIER:
            assert drop == PickupKind.CRYSTAL
        else:
            assert drop == -1


def test_both_carriers_carry_a_crystal_both_turrets_a_bomb_and_nothing_else_drops_anything() -> (
    None
):
    carriers = [entry for entry in GALLERY_SCRIPT if entry[1] == EnemyKind.CARRIER]
    assert len(carriers) == 2
    assert all(entry[7] == PickupKind.CRYSTAL for entry in carriers)
    droppers = (EnemyKind.CARRIER, EnemyKind.TURRET)
    assert all(entry[7] == -1 for entry in GALLERY_SCRIPT if entry[1] not in droppers)
