"""The gallery's enemy roster; values index the per-kind tuning tables."""

from enum import IntEnum


class EnemyKind(IntEnum):
    """Enemy types. Values never change: they index ``ENEMY_*`` tuples and cross the boundary."""

    JET = 0
    HELI = 1
    CARRIER = 2
    TANK = 3
    TURRET = 4
    TRAIN = 5  # the mid-boss hull: an armored train on the maglev line (ground unit)
    TRAIN_TURRET = 6  # a destructible gun car on the train
    TRAIN_STUMP = 7  # what a destroyed gun car leaves on the hull
    HOUSE = 8  # city targets (D-05): selected buildings that are destructible ground units
    FUEL_TANK = 9
    DEPOT = 10
    BILLBOARD = 11
    BOMBER = 12  # the stage 1 boss hull: a giant bomber over the city (air unit)
    BOMBER_TURRET = 13  # a destructible wing turret that tracks the ship
    BOMBER_ENGINE = 14  # a destructible engine pod
    BOMBER_STUMP = 15  # what a destroyed wing turret or engine leaves on the hull
    BOMBER_OPEN = 16  # the hull once its core is open (phases 2 and 3)
