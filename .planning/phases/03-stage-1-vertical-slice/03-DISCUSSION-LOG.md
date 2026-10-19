# Phase 3: Stage 1 Vertical Slice - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-10-18
**Phase:** 03-stage-1-vertical-slice
**Areas discussed:** Stage 1 layout & pacing, The boss, Scoring/medals/lives, HUD & end-of-run flow, General game look (the last one added by the user)

---

## Stage 1 layout & pacing

| Question | Options | Selected |
|----------|---------|----------|
| Stage length | ~3 min / ~2 min / ~4-5 min | ~3 min ✓ |
| Mid-boss | Yes, one / No / You decide | Yes, one ✓ |
| Data format | Python data modules / TOML-JSON files | Python data modules ✓ |
| Progression | Scroll-distance / Tick timeline / Wave-gated | Scroll-distance ✓ |
| City destructibility | Selected buildings / Almost everything / Few landmarks | Selected buildings ✓ |
| Boss scroll | Slow to a crawl / Stop / Full speed | Slow to a crawl ✓ |
| Difficulty | Approachable / Arcade-tough | Approachable ✓ |
| Pickup frequency | Generous / Stingy / You decide | Generous ✓ |

## The boss

| Question | Options | Selected |
|----------|---------|----------|
| Boss type | Giant bomber / Land fortress / Gunship heli | Giant bomber ✓ |
| Phases | 3 / 2 | 3 ✓ |
| Timeout | Retreats (no kill bonus) / Self-destructs | Retreats ✓ |
| Mid-boss | Heavy tank-armored train / Gunship / You decide | Heavy tank-armored train ✓ |
| Parts vs phases | HP threshold OR all parts / Parts must die first / Independent | HP threshold OR all parts ✓ |
| Fight length | ~60-75 s, 100 s timeout / ~40 s, 60 s / You decide | ~60-75 s, 100 s timeout ✓ |
| Entrance | WARNING + fly-in / Just fly in | WARNING + fly-in ✓ |
| Part death | Explode + leave damage / Explode and vanish | Explode + leave damage ✓ |

## Scoring, medals & lives

| Question | Options | Selected |
|----------|---------|----------|
| Medals | Raiden II / Strikers flashing / Simple chain | Raiden II ✓ |
| Medal reset on death | Yes / Only on miss | Yes ✓ |
| Lives | 3, extend 200k + every 500k / 3, extends 100k & 300k / You decide | 3, 200k + every 500k ✓ |
| Clear bonus | Boss + medals + no-miss + bombs / Boss + destruction % / Flat | Boss + medals + no-miss + bombs ✓ |
| Score extras | Keep simple / Point-blank bonus | Keep simple ✓ |
| Popups | Medals & parts only / Every kill / None | Medals & parts only ✓ |
| Extend feedback | Banner + jingle / HUD only | Banner + jingle ✓ |
| High score source | localStorage best / Session only | localStorage best ✓ |

## HUD & end-of-run flow

| Question | Options | Selected |
|----------|---------|----------|
| HUD placement | Over playfield edges / Letterbox margins / Adaptive | Over playfield edges ✓ |
| HUD tech/style | DOM overlay pixel font / three.js text | DOM overlay ✓ |
| After clear | Loop stage 1, keep score / To-be-continued screen / Back to start gate | Loop stage 1 ✓ |
| Game over | Overlay + tap to retry / Instant restart | Overlay + tap to retry ✓ |
| Gallery | Keep behind ?gallery / Remove | Keep behind ?gallery ✓ |
| Debug jump | ?at=boss/midboss / No | ?at= ✓ |
| Boss HP bar | Thin top bar / No bar | Thin top bar ✓ |
| Stage intro | STAGE 1 banner + fly-in / None | Banner + fly-in ✓ |

## General game look

| Question | Options | Selected |
|----------|---------|----------|
| Mood | Dusk smoky orange / Night ablaze / Daylight | Dusk ✓ |
| City build | Hand-placed blocks on road grid / Procedural fill | Hand-placed ✓ |
| Atmosphere | Rich, tier-scaled / Moderate | Rich, tier-scaled ✓ |
| Stage arc | Outskirts → downtown → airfield / One district / You decide | Outskirts → downtown → airfield ✓ |
| Look scope | Re-light everything / Environment only / Bigger art pass | Re-light everything ✓ |
| Faction scheme | Consistent faction colors / Keep current | Faction colors ✓ |
| Anything else | No / Describe | No ✓ |

The user accepted the recommended option on every question except boss type, where they chose the giant bomber from three unranked options.

## Claude's Discretion

Mid-boss staging, HP and timeout; exact score, medal and bonus numbers; wave and path vocabulary; boss patterns; pixel font; lighting, fog and fire technique; timeline-to-terrain mapping and protocol changes.

## Deferred Ideas

None.

---

## Revision: cyberpunk art direction (same day, after the context was first written)

The user asked for a cyberpunk style, which replaced the dusk / smoky-orange "General game look" decisions.

| Question | Options | Selected |
|----------|---------|----------|
| Scope | Neon military / Full cyberpunk theme / Stage 1 only | Neon military ✓ |
| Bullet vs magenta clash | Bullets change color / Keep pink, avoid magenta neon | Bullets change color ✓ |
| Mood | Night rain neon / Smoggy neon dusk / Synthwave | Night rain neon ✓ |
| Warzone | Neon city under attack / Intact clean megacity | Under attack ✓ |
| Bullet color | Orange-yellow white core / Acid lime / White with outline | Orange-yellow ✓ |
| Game-wide | Whole game / Stage 1 only | Whole game ✓ |
| Stage arc | Slums → downtown → rooftop airbase / Downtown only / You decide | Slums → downtown → airbase ✓ |
| Faction colors | Player cyan/white, enemies red neon / Player magenta, enemies cyan | Player cyan/white, enemies red ✓ |

Claude's note: orange-yellow bullets collide with the orange fire, gold medals and amber bomb pickup, so CONTEXT D-40 requires retinting those and leaves the exact palette to Claude's discretion.
