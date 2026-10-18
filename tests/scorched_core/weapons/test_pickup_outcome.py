from scorched_core.weapons.pickup_outcome import PickupOutcome


def test_pickup_outcomes_have_stable_values() -> None:
    assert [(outcome.name, outcome.value) for outcome in PickupOutcome] == [
        ("RAISED", 0),
        ("SWITCHED", 1),
        ("MAXED", 2),
        ("STOCKED", 3),
    ]
