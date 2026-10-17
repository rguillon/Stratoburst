"""Button bits crossing the JS/Python boundary."""

from enum import IntFlag


class Button(IntFlag):
    """Buttons the player can press; JS reads the bit values from the manifest."""

    FIRE = 1
    BOMB = 2
    PAUSE = 4
