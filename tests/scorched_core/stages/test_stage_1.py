import itertools

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.paths.path_library import PATHS, path_index
from scorched_core.patterns.fire_pattern import FirePattern
from scorched_core.patterns.pattern_library import PATTERNS, pattern_index
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import PLAYFIELD_W
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
from scorched_core.tuning import ENEMY_MAX_ALIVE, GROUND_SCROLL_RATIO, SCROLL_SPEED

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


def test_the_opening_uses_every_roster_kind() -> None:
    assert {wave.kind for wave in STAGE_1.waves} == set(EnemyKind)


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
    assert spawned == len(STAGE_1.waves)  # no spawn was refused by the alive cap
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
