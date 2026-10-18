"""Boundary contract between the Python core and the JS renderer (constants only)."""

from typing import Final

PROTOCOL_VERSION: Final = 2

# Logical playfield in game units; origin top-left, y grows downward (D-06).
PLAYFIELD_W: Final = 240.0
PLAYFIELD_H: Final = 320.0

# Header channel: 48 float32 slots read by JS through the manifest.
HEADER_LEN: Final = 48
H_STEPS: Final = 0
H_SCROLL_Y: Final = 1
H_ALPHA: Final = 2
H_SHIP_X: Final = 3
H_SHIP_Y: Final = 4
H_FLAGS: Final = 5
H_PBULLET_N: Final = 6
H_EBULLET_N: Final = 7
H_ENEMY_N: Final = 8
H_TICK_COUNT: Final = 9
H_STORM_HITS: Final = 10
H_KILLS: Final = 11
H_EVENT_N: Final = 12
H_EVENT_DROPPED: Final = 13
# Slots 14-29 are reserved by later Phase 2 plans (numbering table in 02-01-PLAN.md) and
# slots 30-47 by Phase 3. Plan 02-08 takes the weapon slots, plan 02-10 the pickup slots.
H_PICKUP_N: Final = 15
H_WEAPON: Final = 16
H_LEVEL: Final = 17

FLAG_PAUSED: Final = 1
FLAG_FIRING: Final = 2

# Instance channels: floats per instance and capacity.
PBULLET_STRIDE: Final = 4
PBULLET_CAP: Final = 128
EBULLET_STRIDE: Final = 4
EBULLET_MIN_CAP: Final = 600
EBULLET_MAX_CAP: Final = 5000
ENEMY_STRIDE: Final = 8
ENEMY_CAP: Final = 48
PICKUP_STRIDE: Final = 4  # x, y, colour index, kind
PICKUP_CAP: Final = 16

# Events channel: one record per event, written fresh every tick (never replayed).
EVENT_STRIDE: Final = 6  # kind, x, y, a, b, c
EVENT_CAP: Final = 128
# Low-priority events (hit sparks) are refused once this many are queued, so kills always fit.
EVENT_SOFT_CAP: Final = 96

# Event ids. Values never change meaning once shipped; JS reads them by name from the manifest.
EV_EXPLOSION: Final = 1
EV_HIT: Final = 2
EV_SHOT: Final = 3
EV_PICKUP: Final = 4
EV_ENEMY_FIRE: Final = 5
EV_PLAYER_HIT: Final = 6
EV_PLAYER_DEATH: Final = 7
EV_RESPAWN: Final = 8
EV_BOMB_LAUNCH: Final = 9
EV_BOMB_DETONATE: Final = 10
EV_DEATHBOMB_SAVE: Final = 11
EV_SFX: Final = 12

# Blast classes carried in an EXPLOSION event's ``a`` payload (D-22).
BLAST_SMALL: Final = 0
BLAST_MEDIUM: Final = 1
BLAST_LARGE: Final = 2
