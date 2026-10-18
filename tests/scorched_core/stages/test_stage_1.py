import itertools

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.patterns.fire_pattern import FirePattern
from scorched_core.patterns.pattern_library import PATTERNS
from scorched_core.protocol import PLAYFIELD_W
from scorched_core.stages.stage_1 import STAGE_1
from scorched_core.stages.stage_data import StageData

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


def test_ground_units_use_the_ground_motion_on_a_road_centre() -> None:
    ground = [w for w in STAGE_1.waves if w.kind in (EnemyKind.TANK, EnemyKind.TURRET)]
    assert ground
    assert all(wave.motion == MotionKind.GROUND for wave in ground)
    assert all(wave.x in ROAD_CENTRES for wave in ground)


def test_air_units_never_use_the_ground_motion() -> None:
    air = (EnemyKind.JET, EnemyKind.HELI, EnemyKind.CARRIER)
    assert all(w.motion != MotionKind.GROUND for w in STAGE_1.waves if w.kind in air)


def test_an_aa_turret_drops_a_bomb() -> None:
    turrets = [wave for wave in STAGE_1.waves if wave.kind == EnemyKind.TURRET]
    assert turrets
    assert all(wave.drop == PickupKind.BOMB for wave in turrets)


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


def test_the_named_patterns_sit_on_the_opening_waves() -> None:
    assert {"spread3", "ring10_slow", "aimed_slow", "stream3"} <= _named_patterns()
    assert all(wave.at < 1500.0 for wave in STAGE_1.waves if wave.pattern is not None)
