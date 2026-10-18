from scorched_core.stages.scenery_kind import SceneryKind


def test_scenery_kind_values_are_fixed_because_they_cross_the_boundary() -> None:
    assert {kind.name: kind.value for kind in SceneryKind} == {
        "SLUM_HOUSE": 0,
        "LOWRISE": 1,
        "TOWER": 2,
        "SIGN": 3,
        "MAGLEV": 4,
        "HANGAR": 5,
        "RUNWAY_LIGHT": 6,
        "FIRE": 7,
        "LAMP": 8,
    }
