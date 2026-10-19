from scorched_core.stages.flow_state import FlowState


def test_flow_state_values_are_stable() -> None:
    assert [state.value for state in FlowState] == [0, 1, 2, 3, 4, 5, 6, 7, 8]
    assert FlowState.INTRO == 0
    assert FlowState.PLAY == 1
    assert FlowState.MIDBOSS == 2
    assert FlowState.WARNING == 3
    assert FlowState.BOSS == 4
    assert FlowState.CLEAR == 5
    assert FlowState.TALLY == 6
    assert FlowState.STAGE_CLEAR == 7
    assert FlowState.GAME_OVER == 8


def test_flow_state_names_are_the_boundary_names() -> None:
    assert [state.name for state in FlowState] == [
        "INTRO",
        "PLAY",
        "MIDBOSS",
        "WARNING",
        "BOSS",
        "CLEAR",
        "TALLY",
        "STAGE_CLEAR",
        "GAME_OVER",
    ]
