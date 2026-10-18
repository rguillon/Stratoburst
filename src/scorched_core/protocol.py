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
# slots 30-47 by Phase 3. Plan 02-08 takes the weapon slots; plan 02-10 takes PICKUP_N and
# MAX_BONUS; plan 02-13 takes MISSILE_N; plan 02-16 takes STORM_N; plan 02-20 takes
# PLAYER_PHASE, INVULN and DEATHS; plan 02-21 takes BEAM_W; plan 02-22 takes the bomb slots.
H_PICKUP_N: Final = 15
H_WEAPON: Final = 16
H_LEVEL: Final = 17
H_BEAM_W: Final = 18  # laser beam half-width in units, 0 when the beam is off
H_MISSILE_N: Final = 19
H_MAX_BONUS: Final = 20
H_STORM_N: Final = 21
H_PLAYER_PHASE: Final = 22
H_INVULN: Final = 23
H_DEATHS: Final = 24
H_BOMBS: Final = 25  # bombs left in the stock
H_BOMB_PHASE: Final = 26  # BombPhase: NONE 0, LAUNCH 1, BLAST 2
H_BOMB_X: Final = 27  # missile position while launching, blast centre while blasting
H_BOMB_Y: Final = 28
H_BOMB_T: Final = 29  # progress 0..1 within the current bomb phase

FLAG_PAUSED: Final = 1
FLAG_FIRING: Final = 2

# Instance channels: floats per instance and capacity.
PBULLET_STRIDE: Final = 4
PBULLET_CAP: Final = 128
EBULLET_STRIDE: Final = 4
EBULLET_MIN_CAP: Final = 600
EBULLET_MAX_CAP: Final = 5000
EBULLET_GAME_CAP: Final = 200  # gameplay enemy bullets, packed after the storm in one channel
ENEMY_STRIDE: Final = 8
ENEMY_CAP: Final = 48
PICKUP_STRIDE: Final = 4  # x, y, colour index, kind
PICKUP_CAP: Final = 16
MISSILE_STRIDE: Final = 4  # x, y, angle, life fraction
MISSILE_CAP: Final = 48

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
