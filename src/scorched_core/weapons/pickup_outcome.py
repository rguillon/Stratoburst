"""What a crystal pickup did, reported to the player and (later) to scoring."""

from enum import IntEnum


class PickupOutcome(IntEnum):
    """Result of catching a pickup; the value is the PICKUP event's ``b`` payload.

    STOCKED is the outcome of a bomb pickup (plan 02-26); it is defined here so that plan
    adds no enum file.
    """

    RAISED = 0
    SWITCHED = 1
    MAXED = 2
    STOCKED = 3
