"""Button bits crossing the JS/Python boundary (skeleton: values arrive with the GREEN commit)."""

from enum import IntFlag


class Button(IntFlag):
    """Buttons the player can press; JS reads the bit values from the manifest."""

    FIRE = 0
    BOMB = 0
    PAUSE = 0
