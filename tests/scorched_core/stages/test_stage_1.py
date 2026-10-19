import hashlib
import itertools
import math

import pytest

from scorched_core.bosses.stage_1_bosses import BOMBER_1, MIDBOSS_1
from scorched_core.clock.fixed_step_runner import STEP_MS
from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.game.game import Game
from scorched_core.input.button import Button
from scorched_core.paths.path_library import PATHS, path_index
from scorched_core.patterns.fire_pattern import FirePattern
from scorched_core.patterns.pattern_library import PATTERNS, pattern_index
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import CITY_STRIDE, H_NEW_RECORD, PLAYFIELD_W
from scorched_core.stages.city_builder import target_entries
from scorched_core.stages.city_style import CityStyle
from scorched_core.stages.flow_state import FlowState
from scorched_core.stages.scenery_kind import SceneryKind
from scorched_core.stages.stage_1 import (
    AIRBASE_AT,
    BOSS_QUIET,
    DOWNTOWN_AT,
    MIDBOSS_LULL,
    STAGE_1,
)
from scorched_core.stages.stage_data import StageData
from scorched_core.stages.stage_director import StageDirector
from scorched_core.stages.wave_entry import WaveEntry
from scorched_core.tuning import (
    CITY_CORRIDOR_HALF,
    CITY_MAX_HEIGHT,
    CITY_PITCH,
    ENEMY_MAX_ALIVE,
    ENEMY_RADIUS,
    GROUND_SCROLL_RATIO,
    SCROLL_SPEED,
)
from scorched_core.weapons.weapon_kind import WeaponKind

ROAD_CENTRES = (80.0, 160.0)
DISTANCE_PER_SECOND = 48.0  # 60 steps at 0.8 units each


def test_stage_1_is_stage_data_number_one() -> None:
    assert isinstance(STAGE_1, StageData)
    assert STAGE_1.number == 1


def test_stage_1_has_midboss_and_boss_markers() -> None:
    assert STAGE_1.marker("midboss") == 4200.0
    assert STAGE_1.marker("boss") == 8640.0


def test_the_boss_marker_is_about_three_minutes_in() -> None:
    assert STAGE_1.marker("boss") / DISTANCE_PER_SECOND == 180.0


def test_the_stage_runs_on_past_the_boss_marker() -> None:
    assert STAGE_1.length >= STAGE_1.marker("boss") + 600.0


def test_the_timeline_is_sorted_and_inside_the_stage() -> None:
    ats = [wave.at for wave in STAGE_1.waves]
    assert ats == sorted(ats)
    assert ats[0] >= 0.0
    assert ats[-1] <= STAGE_1.length


def test_nothing_spawns_at_the_very_start() -> None:
    assert STAGE_1.waves[0].at > 0.0


def test_every_entry_enters_inside_the_horizontal_spawn_band() -> None:
    assert all(-24.0 <= wave.x <= PLAYFIELD_W + 24.0 for wave in STAGE_1.waves)


def test_consecutive_carriers_are_thirty_to_forty_seconds_apart() -> None:
    carriers = [wave.at for wave in STAGE_1.waves if wave.kind == EnemyKind.CARRIER]
    assert len(carriers) >= 2
    for earlier, later in itertools.pairwise(carriers):
        assert 1440.0 <= later - earlier <= 1920.0


def test_every_carrier_drops_a_crystal() -> None:
    carriers = [wave for wave in STAGE_1.waves if wave.kind == EnemyKind.CARRIER]
    assert all(wave.drop == PickupKind.CRYSTAL for wave in carriers)


def test_turrets_stand_still_on_the_terrain_inside_the_field() -> None:
    turrets = [w for w in STAGE_1.waves if w.kind == EnemyKind.TURRET]
    assert turrets
    assert all(wave.motion == MotionKind.GROUND for wave in turrets)
    assert all(20.0 <= wave.x <= PLAYFIELD_W - 20.0 for wave in turrets)


def test_tanks_start_on_a_road_centre_and_crawl_or_follow_a_road_path() -> None:
    tanks = [w for w in STAGE_1.waves if w.kind == EnemyKind.TANK]
    assert tanks
    assert all(wave.motion in (MotionKind.GROUND, MotionKind.PATH) for wave in tanks)
    assert all(wave.x in ROAD_CENTRES for wave in tanks)
    assert all(wave.path in (None, "road_down", "road_bend") for wave in tanks)


def test_air_units_never_use_the_ground_motion() -> None:
    air = (EnemyKind.JET, EnemyKind.HELI, EnemyKind.CARRIER)
    assert all(w.motion != MotionKind.GROUND for w in STAGE_1.waves if w.kind in air)


def test_at_least_three_aa_turrets_drop_a_bomb() -> None:
    bombers = [wave for wave in STAGE_1.waves if wave.drop == PickupKind.BOMB]
    assert len(bombers) >= 3
    assert all(wave.kind == EnemyKind.TURRET for wave in bombers)
    assert len(bombers) <= 8  # a few, not a flood (D-08)


def test_the_opening_uses_every_gallery_kind() -> None:
    boss_kinds = {  # boss rows
        EnemyKind.TRAIN,
        EnemyKind.TRAIN_TURRET,
        EnemyKind.TRAIN_STUMP,
        EnemyKind.BOMBER,
        EnemyKind.BOMBER_TURRET,
        EnemyKind.BOMBER_ENGINE,
        EnemyKind.BOMBER_STUMP,
        EnemyKind.BOMBER_OPEN,
    }
    target_kinds = {EnemyKind.HOUSE, EnemyKind.FUEL_TANK, EnemyKind.DEPOT, EnemyKind.BILLBOARD}
    assert {wave.kind for wave in STAGE_1.waves} == set(EnemyKind) - boss_kinds - target_kinds


def test_jets_sweep_in_from_both_sides() -> None:
    dives = [w for w in STAGE_1.waves if w.kind == EnemyKind.JET and w.motion == MotionKind.DIVE]
    assert any(w.x < 0.0 and w.vx > 0.0 for w in dives)
    assert any(w.x > PLAYFIELD_W and w.vx < 0.0 for w in dives)


def _named_patterns() -> set[str]:
    return {wave.pattern for wave in STAGE_1.waves if wave.pattern is not None}


def test_the_opening_uses_a_spread_a_ring_and_a_stream() -> None:
    shapes = {PATTERNS[name].shape for name in _named_patterns()}
    assert {FirePattern.SPREAD, FirePattern.RING, FirePattern.STREAM} <= shapes


def test_every_stage_pattern_keeps_raiden_pacing() -> None:
    assert _named_patterns()
    for name in _named_patterns():
        assert PATTERNS[name].speed <= 2.0, name
        assert PATTERNS[name].interval >= 90, name


def test_the_opening_waves_name_their_patterns() -> None:
    opening = {wave.pattern for wave in STAGE_1.waves if wave.at < 1500.0 and wave.pattern}
    assert {"spread3", "ring10_slow", "aimed_slow", "stream3"} <= opening


def _section(start: float, end: float) -> list[WaveEntry]:
    return [wave for wave in STAGE_1.waves if start <= wave.at < end]


def test_the_section_constants_sit_between_the_opening_and_the_boss() -> None:
    assert 2000.0 < DOWNTOWN_AT < STAGE_1.marker("midboss")
    assert STAGE_1.marker("midboss") + MIDBOSS_LULL < AIRBASE_AT < STAGE_1.marker("boss")
    assert (MIDBOSS_LULL, BOSS_QUIET) == (420.0, 240.0)


def test_the_stage_has_waves_in_the_slums_downtown_and_the_airbase() -> None:
    boss = STAGE_1.marker("boss")
    assert len(_section(0.0, DOWNTOWN_AT)) >= 20
    assert len(_section(DOWNTOWN_AT, AIRBASE_AT)) >= 40
    assert len(_section(AIRBASE_AT, boss)) >= 25


def test_equal_distance_entries_keep_their_authored_order() -> None:
    assert [w.x for w in STAGE_1.waves if w.at == 1850.0] == [50.0, 190.0]
    assert [w.x for w in STAGE_1.waves if w.at == 1950.0] == [80.0, 160.0]


def test_consecutive_carriers_over_the_whole_stage_keep_the_crystal_rhythm() -> None:
    carriers = [wave.at for wave in STAGE_1.waves if wave.kind == EnemyKind.CARRIER]
    assert len(carriers) >= 5
    assert carriers[0] < 1000.0
    assert STAGE_1.marker("boss") - carriers[-1] <= 1920.0 + BOSS_QUIET


def test_nothing_spawns_in_the_mid_boss_lull() -> None:
    midboss = STAGE_1.marker("midboss")
    assert _section(midboss, midboss + MIDBOSS_LULL) == []
    assert _section(midboss + MIDBOSS_LULL, midboss + MIDBOSS_LULL + 120.0)  # then it resumes


def test_the_screen_is_clear_for_a_while_before_the_mid_boss() -> None:
    midboss = STAGE_1.marker("midboss")
    assert _section(midboss - 60.0, midboss) == []
    assert _section(midboss - 400.0, midboss - 60.0)


def test_nothing_spawns_in_the_quiet_before_the_boss() -> None:
    boss = STAGE_1.marker("boss")
    assert [w for w in STAGE_1.waves if boss - BOSS_QUIET < w.at <= boss] == []
    assert _section(boss - BOSS_QUIET - 400.0, boss - BOSS_QUIET)


def _air_paths(start: float, end: float) -> set[str]:
    air = (EnemyKind.JET, EnemyKind.HELI)
    return {w.path for w in _section(start, end) if w.kind in air and w.path is not None}


def test_downtown_jets_and_helicopters_fly_at_least_two_different_paths() -> None:
    assert len(_air_paths(DOWNTOWN_AT, AIRBASE_AT)) >= 2


def test_the_airbase_jets_and_helicopters_fly_at_least_two_different_paths() -> None:
    assert len(_air_paths(AIRBASE_AT, STAGE_1.marker("boss"))) >= 2


def test_formations_are_mirrored_pairs_on_both_sides_of_the_field() -> None:
    pathed = [w for w in STAGE_1.waves if w.path is not None]
    assert any(w.mirror for w in pathed)
    assert any(not w.mirror for w in pathed)


def test_a_tank_column_drives_onto_a_crossing_road() -> None:
    bends = [w for w in STAGE_1.waves if w.kind == EnemyKind.TANK and w.path == "road_bend"]
    assert len(bends) >= 3
    assert len({w.at for w in bends}) >= 3  # a column: follow-the-leader, not one blob
    assert {w.x for w in bends} <= set(ROAD_CENTRES)


def test_every_named_path_and_pattern_resolves() -> None:
    for wave in STAGE_1.waves:
        if wave.path is not None:
            assert path_index(wave.path) >= 0
            assert wave.path in PATHS
        if wave.pattern is not None:
            assert pattern_index(wave.pattern) >= 0


def test_path_waves_use_the_path_motion_and_only_those() -> None:
    assert all((w.path is not None) == (w.motion == MotionKind.PATH) for w in STAGE_1.waves)


def test_the_whole_timeline_never_fills_the_enemy_pool() -> None:
    director, pool = StageDirector(STAGE_1), EnemyPool()
    distance, spawned, peak = 0.0, 0, 0
    while distance < STAGE_1.marker("boss"):
        distance += SCROLL_SPEED
        spawned += director.step(distance, pool)
        pool.step(120.0, 272.0, SCROLL_SPEED * GROUND_SCROLL_RATIO)
        peak = max(peak, pool.n)
    # no spawn, wave or target row, was refused by the alive cap
    assert spawned == len(STAGE_1.waves) + len(STAGE_1.ground)
    assert peak <= ENEMY_MAX_ALIVE // 2  # approachable (D-07): half the pool at the very most


def _medal_waves(start: float, end: float) -> list[WaveEntry]:
    return [w for w in _section(start, end) if w.drop == PickupKind.MEDAL]


def test_an_opening_tank_column_on_the_left_road_drops_medals() -> None:
    column = [
        w
        for w in _section(0.0, 1500.0)
        if w.kind == EnemyKind.TANK and w.x == ROAD_CENTRES[0] and w.drop == PickupKind.MEDAL
    ]
    assert len(column) >= 3
    assert all(w.at < 1000.0 for w in column)


def test_only_tanks_and_turrets_drop_medals() -> None:
    medals = [w for w in STAGE_1.waves if w.drop == PickupKind.MEDAL]
    assert medals
    assert all(w.kind in (EnemyKind.TANK, EnemyKind.TURRET) for w in medals)


def test_every_section_has_medal_drops_on_ground_targets() -> None:
    boss = STAGE_1.marker("boss")
    assert len(_medal_waves(0.0, DOWNTOWN_AT)) >= 3
    assert len(_medal_waves(DOWNTOWN_AT, AIRBASE_AT)) >= 3
    assert len(_medal_waves(AIRBASE_AT, boss)) >= 3


def test_medals_are_some_of_the_ground_targets_not_all() -> None:
    ground = [w for w in STAGE_1.waves if w.kind in (EnemyKind.TANK, EnemyKind.TURRET)]
    medals = [w for w in ground if w.drop == PickupKind.MEDAL]
    assert len(medals) < len(ground) / 2 + 3


# The city (D-33, D-34, D-35): slums, neon downtown with the maglev, then the airbase.
def _placements(start: float, end: float, *kinds: SceneryKind) -> list[tuple[float, ...]]:
    flat = STAGE_1.placements
    records = [flat[i : i + CITY_STRIDE] for i in range(0, len(flat), CITY_STRIDE)]
    wanted = {int(kind) for kind in kinds}
    return [r for r in records if start <= r[2] < end and (not wanted or int(r[0]) in wanted)]


def test_the_city_covers_every_block_row_in_all_three_playfield_columns() -> None:
    rows = {
        d: {block.col for block in STAGE_1.city if block.d == d}
        for d in {block.d for block in STAGE_1.city}
    }
    expected = {CITY_PITCH * row for row in range(math.ceil(STAGE_1.length / CITY_PITCH))}
    assert set(rows) == expected
    assert all(cols == {0, 1, 2} for cols in rows.values())


def test_the_city_arc_is_slums_then_downtown_then_the_airbase() -> None:
    assert {block.style for block in STAGE_1.city} == set(CityStyle)
    for block in STAGE_1.city:
        if block.d < DOWNTOWN_AT:
            assert block.style == CityStyle.SLUMS, block
        elif block.d < AIRBASE_AT:
            assert block.style == CityStyle.DOWNTOWN, block
        else:
            assert block.style == CityStyle.AIRBASE, block


def test_the_maglev_runs_along_x_120_across_the_midboss_marker() -> None:
    midboss = STAGE_1.marker("midboss")
    maglev = [f for f in STAGE_1.features if f.kind == SceneryKind.MAGLEV]
    assert len(maglev) == 1
    assert maglev[0].x == 120.0
    assert maglev[0].d0 <= midboss - 400.0
    assert maglev[0].d1 >= midboss + 800.0
    assert DOWNTOWN_AT <= maglev[0].d0 <= maglev[0].d1 <= AIRBASE_AT


def test_the_runway_lights_lie_in_the_airbase_and_cover_the_boss_marker() -> None:
    boss = STAGE_1.marker("boss")
    lights = [f for f in STAGE_1.features if f.kind == SceneryKind.RUNWAY_LIGHT]
    assert lights
    assert all(f.d0 >= AIRBASE_AT and f.d0 <= boss <= f.d1 for f in lights)


def test_burning_ruins_appear_in_every_section() -> None:
    boss = STAGE_1.marker("boss")
    for start, end in ((0.0, DOWNTOWN_AT), (DOWNTOWN_AT, AIRBASE_AT), (AIRBASE_AT, boss)):
        assert len(_placements(start, end, SceneryKind.FIRE)) >= 4


def test_downtown_blocks_carry_signs_and_towers() -> None:
    downtown = [b for b in STAGE_1.city if b.style == CityStyle.DOWNTOWN]
    assert all(b.signs >= 1 for b in downtown)
    assert len(_placements(DOWNTOWN_AT, AIRBASE_AT, SceneryKind.TOWER)) > 20
    assert len(_placements(DOWNTOWN_AT, AIRBASE_AT, SceneryKind.SIGN)) > 20


def test_the_slums_are_low_with_sparse_neon_and_the_airbase_has_hangars() -> None:
    assert not _placements(0.0, DOWNTOWN_AT, SceneryKind.TOWER)
    slum_signs = _placements(0.0, DOWNTOWN_AT, SceneryKind.SIGN)
    assert 0 < len(slum_signs) < len(_placements(DOWNTOWN_AT, AIRBASE_AT, SceneryKind.SIGN))
    assert len(_placements(AIRBASE_AT, STAGE_1.length, SceneryKind.HANGAR)) > 20


def test_the_layout_stays_small_and_below_the_gameplay_plane() -> None:
    assert 0 < len(STAGE_1.placements) <= 3000 * CITY_STRIDE
    assert all(r[4] <= CITY_MAX_HEIGHT for r in _placements(0.0, STAGE_1.length * 2))


def test_the_maglev_corridor_is_kept_clear_of_buildings() -> None:
    buildings = _placements(
        3500.0,
        5300.0,
        SceneryKind.TOWER,
        SceneryKind.LOWRISE,
        SceneryKind.SLUM_HOUSE,
        SceneryKind.HANGAR,
    )
    assert buildings
    assert all(abs(r[1] - 120.0) - r[3] / 2 >= 6.0 - 1e-9 for r in buildings)


# --- destructible city targets (plan 03-15) ----------------------------------------------------

TARGET_KINDS = (EnemyKind.HOUSE, EnemyKind.FUEL_TANK, EnemyKind.DEPOT, EnemyKind.BILLBOARD)
ONE_SCREEN = 425.0  # distance units the playfield shows at once (about 8.9 s of scroll)


def _target_kinds_in(style: CityStyle) -> set[EnemyKind]:
    return {kind for block in STAGE_1.city if block.style == style for _, kind, _ in block.targets}


def test_the_ground_rows_are_the_expansion_of_the_flagged_lots_and_nothing_else() -> None:
    assert STAGE_1.ground
    assert STAGE_1.ground == target_entries(STAGE_1.city)
    assert {entry.kind for entry in STAGE_1.ground} <= set(TARGET_KINDS)


def test_the_slums_have_house_and_fuel_tank_targets() -> None:
    assert _target_kinds_in(CityStyle.SLUMS) == {EnemyKind.HOUSE, EnemyKind.FUEL_TANK}


def test_downtown_has_billboard_and_depot_targets() -> None:
    assert _target_kinds_in(CityStyle.DOWNTOWN) == {EnemyKind.BILLBOARD, EnemyKind.DEPOT}


def test_the_airbase_has_fuel_tank_and_depot_targets() -> None:
    assert _target_kinds_in(CityStyle.AIRBASE) == {EnemyKind.FUEL_TANK, EnemyKind.DEPOT}


def test_an_early_slums_target_stands_at_x_40_in_the_left_column() -> None:
    early = [e for e in STAGE_1.ground if e.at < 1200.0 and e.x == 40.0]
    assert early
    assert all(e.kind in (EnemyKind.HOUSE, EnemyKind.FUEL_TANK) for e in early)


def test_at_least_half_of_the_targets_drop_a_medal() -> None:
    medals = [e for e in STAGE_1.ground if e.drop == PickupKind.MEDAL]
    assert len(medals) * 2 >= len(STAGE_1.ground)
    assert all(e.drop in (None, PickupKind.MEDAL) for e in STAGE_1.ground)


def test_only_selected_buildings_are_targets() -> None:
    flagged = sum(len(block.targets) for block in STAGE_1.city)
    assert flagged == len(STAGE_1.ground)
    assert flagged * 4 < len(STAGE_1.city)  # a minority of the blocks, the rest is scenery


def test_targets_keep_the_quiet_before_the_boss() -> None:
    assert max(e.at for e in STAGE_1.ground) < STAGE_1.marker("boss") - BOSS_QUIET


def test_no_target_stands_in_a_maglev_or_runway_corridor() -> None:
    for feature in (f for f in STAGE_1.features if f.kind != SceneryKind.TOWER):
        for entry in STAGE_1.ground:
            radius = ENEMY_RADIUS[entry.kind]
            inside_x = abs(entry.x - feature.x) < CITY_CORRIDOR_HALF + radius
            inside_d = feature.d0 <= entry.at <= feature.d1
            assert not (inside_x and inside_d), (entry, feature)


def test_ground_rows_per_screen_budget_never_exceeds_twenty() -> None:
    ats = [entry.at for entry in STAGE_1.ground]
    for start in range(0, int(STAGE_1.length), 10):
        assert sum(1 for at in ats if start <= at < start + ONE_SCREEN) <= 20


def test_every_target_spawns_and_an_undamaged_one_scrolls_off_and_is_gone() -> None:
    """Run the whole stage with nobody shooting: the budget holds and nothing is refused."""
    director, enemies = StageDirector(STAGE_1), EnemyPool()
    seen: set[int] = set()
    most, distance = 0, 0.0
    while distance < STAGE_1.length:
        distance += SCROLL_SPEED
        director.step(distance, enemies)
        enemies.step(120.0, 270.0, SCROLL_SPEED * GROUND_SCROLL_RATIO)
        alive = [i for i in range(enemies.n) if enemies.kind[i] in TARGET_KINDS]
        seen.update(enemies.uid[i] for i in alive)
        most = max(most, len(alive))
    assert len(seen) == len(STAGE_1.ground)
    assert 0 < most <= 20
    assert not [i for i in range(enemies.n) if enemies.kind[i] in TARGET_KINDS]
    assert enemies.kills == 0


def test_the_stage_runs_the_armored_train_as_its_midboss_and_the_bomber_as_its_boss() -> None:
    assert STAGE_1.midboss is MIDBOSS_1
    assert STAGE_1.boss is BOMBER_1


def test_the_train_rides_the_maglev_line() -> None:
    maglev = next(f for f in STAGE_1.features if f.kind == SceneryKind.MAGLEV)
    assert maglev.x == MIDBOSS_1.x
    assert maglev.d0 < STAGE_1.marker("midboss") < maglev.d1


def test_the_train_is_in_place_long_before_the_lull_after_its_marker_ends() -> None:
    entrance_steps = (MIDBOSS_1.hold_y - MIDBOSS_1.enter_y) / MIDBOSS_1.enter_speed
    assert entrance_steps * SCROLL_SPEED < MIDBOSS_LULL / 2  # even at full scroll speed
    assert MIDBOSS_LULL == 420.0


def test_no_wave_lies_in_the_lull_right_after_the_midboss_marker() -> None:
    midboss = STAGE_1.marker("midboss")
    assert [w for w in STAGE_1.waves if midboss <= w.at < midboss + MIDBOSS_LULL] == []


# --- the whole stage, played through natively (plan 03-27) ---------------------------------------

STAGE_BULLET_BUDGET = (
    180  # live gameplay enemy bullets at the very most: under half the 400 cap (D-07)
)
FULL_STAGE_STEPS = 20000  # the play-through reaches the clear well inside this (about 17300)
SWEEP_STEPS = 90  # the scripted ship sweeps right, then left, this many steps at a time
PLAY_THROUGH = [
    FlowState.INTRO,
    FlowState.PLAY,
    FlowState.MIDBOSS,
    FlowState.PLAY,
    FlowState.WARNING,
    FlowState.BOSS,
    FlowState.CLEAR,
    FlowState.TALLY,
    FlowState.STAGE_CLEAR,
]


def _play_the_full_stage() -> tuple[Game, list[FlowState], int, str]:
    """God, a Lv5 laser, fire held and a left-right sweep from distance 0 until STAGE_CLEAR.

    Returns the game, the flow states visited in order, the peak live gameplay enemy bullets and
    a digest of header slots 0..49 over every tick.
    """
    game = Game(stage=STAGE_1, god=True, weapon=WeaponKind.LASER, level=5)
    assert game.flow is not None
    states: list[FlowState] = []
    peak = 0
    digest = hashlib.sha256()
    header = game.buffers["header"]
    for step in range(FULL_STAGE_STEPS):
        sweep = 1.0 if (step // SWEEP_STEPS) % 2 == 0 else -1.0
        game.tick(STEP_MS, Button.FIRE, sweep, 0.0, 0.0, 0.0)
        if not states or states[-1] is not game.flow.state:
            states.append(game.flow.state)
        peak = max(peak, game.ebullets.n)
        digest.update(header[: H_NEW_RECORD + 1].tobytes())
        if game.flow.state is FlowState.STAGE_CLEAR:
            break
    return game, states, peak, digest.hexdigest()


@pytest.fixture(scope="module")
def full_stage() -> tuple[Game, list[FlowState], int, str]:
    return _play_the_full_stage()


def test_full_stage_plays_from_the_start_through_both_bosses_to_the_clear(
    full_stage: tuple[Game, list[FlowState], int, str],
) -> None:
    _, states, _, _ = full_stage
    assert states == PLAY_THROUGH


def test_full_stage_refuses_no_enemy_spawn_and_drops_no_high_priority_event(
    full_stage: tuple[Game, list[FlowState], int, str],
) -> None:
    game, _, _, _ = full_stage
    assert game.enemies.refused == 0
    assert game.events.dropped_high == 0


def test_full_stage_keeps_raiden_pacing_in_the_bullet_count(
    full_stage: tuple[Game, list[FlowState], int, str],
) -> None:
    _, _, peak, _ = full_stage
    assert 0 < peak <= STAGE_BULLET_BUDGET


def test_full_stage_is_deterministic(full_stage: tuple[Game, list[FlowState], int, str]) -> None:
    _, _, _, digest = full_stage
    assert _play_the_full_stage()[3] == digest
