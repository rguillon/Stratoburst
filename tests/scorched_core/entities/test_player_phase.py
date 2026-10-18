from scorched_core.entities.player_phase import PlayerPhase


def test_phase_values_are_stable() -> None:
    assert [phase.value for phase in PlayerPhase] == [0, 1, 2, 3, 4]
    assert PlayerPhase.ALIVE == 0
    assert PlayerPhase.GRACE == 1
    assert PlayerPhase.DYING == 2
    assert PlayerPhase.RESPAWN == 3
    assert PlayerPhase.OUT == 4
