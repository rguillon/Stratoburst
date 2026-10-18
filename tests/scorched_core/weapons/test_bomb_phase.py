from scorched_core.weapons.bomb_phase import BombPhase


def test_the_phase_values_are_the_wire_values() -> None:
    assert [(phase.name, phase.value) for phase in BombPhase] == [
        ("NONE", 0),
        ("LAUNCH", 1),
        ("BLAST", 2),
    ]
