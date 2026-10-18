import pytest

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
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
