from scorched_core.entities.motion_kind import MotionKind


def test_the_motion_values_are_the_stored_column_values() -> None:
    assert {motion.name: motion.value for motion in MotionKind} == {
        "SWAY": 0,
        "DIVE": 1,
        "HOVER": 2,
        "GROUND": 3,
        "PATH": 4,
        "SCRIPTED": 5,
    }


def test_a_motion_is_usable_as_an_integer_index() -> None:
    table = ("a", "b", "c", "d", "e", "f")
    assert table[MotionKind.HOVER] == "c"
