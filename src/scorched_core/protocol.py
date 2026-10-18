"""Boundary contract between the Python core and the JS renderer (constants only)."""

from typing import Final

PROTOCOL_VERSION: Final = 3

# Logical playfield in game units; origin top-left, y grows downward (D-06).
PLAYFIELD_W: Final = 240.0
PLAYFIELD_H: Final = 320.0

# Header channel: 64 float32 slots read by JS through the manifest.
HEADER_LEN: Final = 64
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
# Slots 14-29 were reserved by the Phase 2 plans (numbering table in 02-01-PLAN.md) and slots
# 30-49 hold the Phase 3 state (numbering table in 03-04-PLAN.md). Plan 02-08 takes the weapon
# slots; plan 02-10 takes PICKUP_N and MAX_BONUS; plan 02-13 takes MISSILE_N; plan 02-16 takes
# STORM_N; plan 02-20 takes PLAYER_PHASE, INVULN and DEATHS; plan 02-21 takes BEAM_W; plan 02-22
# takes the bomb slots; plan 02-28 takes HITSTOP.
H_HITSTOP: Final = 14  # simulation steps still frozen by hitstop, 0 when running
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

# Phase 3 state (protocol 3). Each plan fills its slots; the numbers are fixed here for good.
H_SCORE: Final = 30
H_HIGH_SCORE: Final = 31
H_LIVES: Final = 32
H_FLOW: Final = 33  # FlowState, or -1 in the shooting gallery
H_FLOW_T: Final = 34  # seconds spent in the current flow state
H_STAGE: Final = 35  # stage number, 0 in the shooting gallery
H_STAGE_DIST: Final = 36  # scroll distance travelled on the stage timeline
H_SCROLL_RATE: Final = 37  # live scroll speed in units per step (the renderer extrapolates with it)
H_BOSS_ACTIVE: Final = 38
H_BOSS_PHASE: Final = 39
H_BOSS_HP: Final = 40
H_BOSS_TIMER_S: Final = 41
H_MEDAL_VALUE: Final = 42
H_MEDAL_CHAIN: Final = 43
H_TALLY_BOSS: Final = 44
H_TALLY_MEDALS: Final = 45
H_TALLY_NO_MISS: Final = 46
H_TALLY_BOMBS: Final = 47
H_TALLY_N: Final = 48
H_NEW_RECORD: Final = 49
# Slots 50-63 are reserved for Phase 4.

FLAG_PAUSED: Final = 1
FLAG_FIRING: Final = 2

# Instance channels: floats per instance and capacity.
PBULLET_STRIDE: Final = 4
PBULLET_CAP: Final = 128
EBULLET_STRIDE: Final = 4
EBULLET_MIN_CAP: Final = 600
EBULLET_MAX_CAP: Final = 5000
EBULLET_GAME_CAP: Final = 400  # gameplay enemy bullets, packed after the storm in one channel
ENEMY_STRIDE: Final = 8
ENEMY_CAP: Final = 64
PICKUP_STRIDE: Final = 4  # x, y, colour index, kind
PICKUP_CAP: Final = 40
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
EV_MEDAL: Final = 13  # x, y, a value, b chain
EV_EXTEND: Final = 14  # x, y, a lives
EV_PART_DESTROYED: Final = 15  # x, y, a points, b part index, c boss slot (1 mid, 2 boss)
EV_BOSS_WARNING: Final = 16
EV_BOSS_PHASE: Final = 17  # a new phase number
EV_BOSS_DEFEATED: Final = 18  # a boss slot
EV_BOSS_RETREAT: Final = 19  # a boss slot
EV_STAGE_START: Final = 20  # a stage number
EV_STAGE_CLEAR: Final = 21  # a stage number
EV_TALLY_LINE: Final = 22  # a line index, b amount
EV_GAME_OVER: Final = 23  # a score, b new record 0/1

# Blast classes carried in an EXPLOSION event's ``a`` payload (D-22).
BLAST_SMALL: Final = 0
BLAST_MEDIUM: Final = 1
BLAST_LARGE: Final = 2
BLAST_HUGE: Final = 3
