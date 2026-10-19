from scorched_core.bosses.boss_state import BossState


def test_the_state_values_are_the_stable_order() -> None:
    assert {state.name: state.value for state in BossState} == {
        "ENTER": 0,
        "FIGHT": 1,
        "DYING": 2,
        "RETREAT": 3,
        "GONE": 4,
    }


def test_a_state_is_usable_as_an_integer() -> None:
    assert int(BossState.DYING) == 2
