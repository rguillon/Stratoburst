"""Boundary contract between the Python core and the JS renderer (constants only)."""

from typing import Final

PROTOCOL_VERSION: Final = 1

# Logical playfield in game units; origin top-left, y grows downward (D-06).
PLAYFIELD_W: Final = 240.0
PLAYFIELD_H: Final = 320.0

# Header channel: 16 float32 slots read by JS through the manifest.
HEADER_LEN: Final = 16
H_STEPS: Final = 0
H_SCROLL_Y: Final = 1
H_ALPHA: Final = 2
H_SHIP_X: Final = 3
H_SHIP_Y: Final = 4
H_FLAGS: Final = 5
H_PBULLET_N: Final = 6
H_EBULLET_N: Final = 7
H_DRONE_N: Final = 8
H_TICK_COUNT: Final = 9
H_STORM_HITS: Final = 10
H_DRONES_DOWN: Final = 11
# Slots 12-15 are spare.

FLAG_PAUSED: Final = 1
FLAG_FIRING: Final = 2

# Instance channels: floats per instance and capacity.
PBULLET_STRIDE: Final = 4
PBULLET_CAP: Final = 128
EBULLET_STRIDE: Final = 4
EBULLET_MIN_CAP: Final = 600
EBULLET_MAX_CAP: Final = 5000
DRONE_STRIDE: Final = 8
DRONE_CAP: Final = 32
