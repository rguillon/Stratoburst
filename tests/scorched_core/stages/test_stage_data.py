import pytest
from scorched_core.bosses.stage_1_bosses import MIDBOSS_1

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.stages.city_block import CityBlock
from scorched_core.stages.city_builder import scenery_placements
from scorched_core.stages.city_feature import CityFeature
from scorched_core.stages.city_style import CityStyle
from scorched_core.stages.ground_entry import GroundEntry
from scorched_core.stages.scenery_kind import SceneryKind
from scorched_core.stages.stage_data import StageData
from scorched_core.stages.wave_entry import WaveEntry


def entry(at: float) -> WaveEntry:
    return WaveEntry(at=at, kind=EnemyKind.JET, x=120.0)


def test_a_sorted_stage_inside_its_length_is_valid() -> None:
    stage = StageData(
        number=1,
        length=100.0,
        waves=(entry(0.0), entry(10.0), entry(10.0), entry(100.0)),
        markers=(("midboss", 50.0),),
    )
    assert stage.number == 1
    assert len(stage.waves) == 4


def test_an_empty_timeline_is_valid() -> None:
    assert StageData(number=1, length=10.0, waves=(), markers=()).waves == ()


def test_waves_out_of_order_are_rejected_naming_the_entry() -> None:
    with pytest.raises(ValueError, match=r"wave 2 .*sorted"):
        StageData(number=1, length=100.0, waves=(entry(5.0), entry(20.0), entry(10.0)), markers=())


def test_a_negative_wave_distance_is_rejected() -> None:
    with pytest.raises(ValueError, match=r"wave 0 .*outside"):
        StageData(number=1, length=100.0, waves=(entry(-1.0),), markers=())


def test_a_wave_past_the_stage_length_is_rejected() -> None:
    with pytest.raises(ValueError, match=r"wave 1 .*outside"):
        StageData(number=1, length=100.0, waves=(entry(5.0), entry(100.5)), markers=())


def test_a_marker_past_the_stage_length_is_rejected() -> None:
    with pytest.raises(ValueError, match=r"marker 'boss' .*outside"):
        StageData(number=1, length=100.0, waves=(), markers=(("boss", 101.0),))


def test_a_negative_marker_is_rejected() -> None:
    with pytest.raises(ValueError, match=r"marker 'midboss' .*outside"):
        StageData(number=1, length=100.0, waves=(), markers=(("midboss", -0.5),))


def test_a_wave_naming_a_known_pattern_is_valid() -> None:
    wave = WaveEntry(at=5.0, kind=EnemyKind.JET, x=120.0, pattern="spread3")
    assert StageData(number=1, length=100.0, waves=(wave,), markers=()).waves == (wave,)


def test_a_wave_naming_an_unknown_pattern_is_rejected_naming_the_entry() -> None:
    waves = (entry(1.0), WaveEntry(at=7.0, kind=EnemyKind.HELI, x=80.0, pattern="nope"))
    with pytest.raises(
        ValueError, match=r"wave 1 \(at=7.0, HELI\) names an unknown pattern 'nope'"
    ):
        StageData(number=1, length=100.0, waves=waves, markers=())


def test_marker_returns_the_named_distance() -> None:
    stage = StageData(number=1, length=100.0, waves=(), markers=(("midboss", 40.0), ("boss", 90.0)))
    assert stage.marker("midboss") == 40.0
    assert stage.marker("boss") == 90.0


def test_an_unknown_marker_raises_key_error() -> None:
    stage = StageData(number=1, length=100.0, waves=(), markers=(("boss", 90.0),))
    with pytest.raises(KeyError):
        stage.marker("nowhere")


def test_a_path_wave_naming_a_known_path_is_valid() -> None:
    wave = WaveEntry(at=5.0, kind=EnemyKind.JET, x=20.0, motion=MotionKind.PATH, path="swoop")
    assert StageData(number=1, length=100.0, waves=(wave,), markers=()).waves == (wave,)


def test_a_wave_naming_an_unknown_path_is_rejected_naming_the_entry() -> None:
    wave = WaveEntry(at=7.0, kind=EnemyKind.HELI, x=80.0, motion=MotionKind.PATH, path="nope")
    with pytest.raises(ValueError, match=r"wave 0 \(at=7.0, HELI\) names an unknown path 'nope'"):
        StageData(number=1, length=100.0, waves=(wave,), markers=())


def test_a_path_on_a_wave_that_is_not_a_path_motion_is_rejected() -> None:
    wave = WaveEntry(at=7.0, kind=EnemyKind.JET, x=80.0, motion=MotionKind.DIVE, path="swoop")
    with pytest.raises(ValueError, match=r"wave 0 \(at=7.0, JET\) .*path.*not PATH"):
        StageData(number=1, length=100.0, waves=(wave,), markers=())


def test_a_path_motion_without_a_path_is_rejected() -> None:
    wave = WaveEntry(at=7.0, kind=EnemyKind.JET, x=80.0, motion=MotionKind.PATH)
    with pytest.raises(ValueError, match=r"wave 0 \(at=7.0, JET\) .*PATH.*no path"):
        StageData(number=1, length=100.0, waves=(wave,), markers=())


def test_a_stage_has_no_city_by_default() -> None:
    stage = StageData(number=1, length=10.0, waves=(), markers=())
    assert (stage.city, stage.features, stage.seed) == ((), (), 1)
    assert stage.placements == ()


def test_a_stage_carries_its_expanded_city_layout() -> None:
    blocks = (CityBlock(d=0.0, col=1, cols=2, rows=2, style=CityStyle.DOWNTOWN, seed=3, signs=1),)
    features = (CityFeature(SceneryKind.MAGLEV, 120.0, 0.0, 80.0, 20.0),)
    stage = StageData(
        number=1, length=100.0, waves=(), markers=(), city=blocks, features=features, seed=9
    )
    assert stage.placements == scenery_placements(blocks, features, 9)
    assert len(stage.placements) > 0


def test_a_city_block_past_the_stage_length_is_rejected() -> None:
    blocks = (CityBlock(d=101.0, col=0, cols=1, rows=1, style=CityStyle.SLUMS, seed=1),)
    with pytest.raises(ValueError, match=r"city block 0 .*outside"):
        StageData(number=1, length=100.0, waves=(), markers=(), city=blocks)


def test_a_city_feature_past_the_stage_length_is_rejected() -> None:
    features = (CityFeature(SceneryKind.MAGLEV, 120.0, 90.0, 120.0, 10.0),)
    with pytest.raises(ValueError, match=r"city feature 0 .*outside"):
        StageData(number=1, length=100.0, waves=(), markers=(), features=features)


def test_a_city_feature_of_an_unsupported_kind_is_rejected_at_construction() -> None:
    features = (CityFeature(SceneryKind.TOWER, 120.0, 0.0, 50.0, 10.0),)
    with pytest.raises(ValueError, match="TOWER"):
        StageData(number=1, length=100.0, waves=(), markers=(), features=features)


def ground(at: float, kind: EnemyKind = EnemyKind.HOUSE) -> GroundEntry:
    return GroundEntry(at=at, kind=kind, x=40.0)


def test_a_stage_has_no_ground_entries_by_default() -> None:
    assert StageData(number=1, length=10.0, waves=(), markers=()).ground == ()


def test_sorted_ground_entries_inside_the_stage_are_valid() -> None:
    entries = (ground(0.0), ground(10.0), ground(10.0), ground(100.0))
    stage = StageData(number=1, length=100.0, waves=(), markers=(), ground=entries)
    assert stage.ground == entries


def test_ground_entries_out_of_order_are_rejected_naming_the_entry() -> None:
    with pytest.raises(ValueError, match=r"ground entry 1 .*sorted"):
        StageData(number=1, length=100.0, waves=(), markers=(), ground=(ground(20.0), ground(10.0)))


def test_a_ground_entry_before_the_stage_is_rejected() -> None:
    with pytest.raises(ValueError, match=r"ground entry 0 .*outside"):
        StageData(number=1, length=100.0, waves=(), markers=(), ground=(ground(-1.0),))


def test_a_ground_entry_past_the_stage_length_is_rejected() -> None:
    with pytest.raises(ValueError, match=r"ground entry 1 .*outside"):
        StageData(number=1, length=100.0, waves=(), markers=(), ground=(ground(5.0), ground(100.5)))


def test_a_stage_has_no_bosses_unless_it_names_them() -> None:
    stage = StageData(number=1, length=10.0, waves=(), markers=())
    assert (stage.midboss, stage.boss) == (None, None)


def test_a_midboss_spec_with_a_midboss_marker_is_valid() -> None:
    stage = StageData(
        number=1, length=100.0, waves=(), markers=(("midboss", 50.0),), midboss=MIDBOSS_1
    )
    assert stage.midboss is MIDBOSS_1


def test_a_midboss_spec_without_a_midboss_marker_is_rejected() -> None:
    with pytest.raises(ValueError, match=r"midboss .*marker"):
        StageData(number=1, length=100.0, waves=(), markers=(("boss", 50.0),), midboss=MIDBOSS_1)


def test_a_boss_spec_with_a_boss_marker_is_valid() -> None:
    stage = StageData(number=1, length=100.0, waves=(), markers=(("boss", 50.0),), boss=MIDBOSS_1)
    assert stage.boss is MIDBOSS_1


def test_a_boss_spec_without_a_boss_marker_is_rejected() -> None:
    with pytest.raises(ValueError, match=r"boss .*marker"):
        StageData(number=1, length=100.0, waves=(), markers=(), boss=MIDBOSS_1)
