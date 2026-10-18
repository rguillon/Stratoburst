from scorched_core.stages.city_style import CityStyle


def test_city_style_values_are_fixed() -> None:
    assert {style.name: style.value for style in CityStyle} == {
        "SLUMS": 0,
        "DOWNTOWN": 1,
        "AIRBASE": 2,
    }
