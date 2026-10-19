from scorched_core.patterns.fire_pattern import FirePattern


def test_fire_pattern_values_are_stable() -> None:
    assert [(p.name, p.value) for p in FirePattern] == [
        ("NONE", 0),
        ("AIMED", 1),
        ("RING", 2),
        ("SPREAD", 3),
        ("STREAM", 4),
    ]
