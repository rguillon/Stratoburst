# Phase 2: Arcade Shooting Feel - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-17
**Phase:** 02-arcade-shooting-feel
**Areas discussed:** Weapons & power, Bomb/death/respawn, Gallery & pickups, Juice/look/sound

---

## Weapons & power

| Question | Options | Selected |
|----------|---------|----------|
| Vulcan growth | Raiden fan / Dense forward + side / You decide | Raiden fan |
| Blue laser | Raiden beam / Fast piercing bolts / You decide | Raiden beam |
| Purple homing | Raiden plasma lock / Homing missiles / You decide | Homing missiles |
| Death power cost | Drop to Lv1 + one pickup / Lose 2 levels / Lose everything, scatter | Lose 2 levels |
| Homing main shot | Weak twin + missiles / Missiles only / You decide | Missiles only |
| Recovery pickup | +1 level current color / Restores both levels / You decide | +1 level current color |
| Same color at Lv5 | Score bonus / Nothing | Score bonus |
| Level on color switch | Keep level / Reset to Lv1 | Keep level |

## Bomb, death & respawn

| Question | Options | Selected |
|----------|---------|----------|
| Bomb style | Raiden nuke / Carpet-bomber flyover / Shockwave ring | Raiden nuke |
| Bomb stock | 3 refilled per life / 3 no refill / 2 refilled per life | 3 refilled per life |
| Deathbomb grace | ~8 frames / ~15 frames / You decide | ~8 frames |
| Touch bomb | Bottom-right in margin / Two-finger tap / Both | Bottom-right in margin |
| Nuke timing | Instant clear, damage ~1.5 s / Clear grows with fireball | Instant clear |
| Respawn | Fly in from bottom / Instant at death spot | Fly in from bottom |
| Fire during blink | Yes / No | Yes |
| Bomb key | Shift or K / Shift/K/X | Shift or K |

## Gallery & pickups

| Question | Options | Selected |
|----------|---------|----------|
| Pickup kind | Color-cycling crystal / Fixed-color pickups | Color-cycling crystal |
| Gallery content | Mixed looping sandbox / Static targets + toggles | Mixed looping sandbox |
| Death in gallery | Yes, infinite lives / ?god toggle / Both | Yes, infinite lives |
| Pickup source | Carrier enemies / Timed spawns | Carrier enemies |
| Recovery pickup color | Fixed to current color / Cycles | Fixed to current color |
| Gallery entry | Default game / Behind ?gallery | Default game |
| Ground scrolling | Scroll with terrain / You decide | Scroll with terrain |

## Juice, look & sound

| Question | Options | Selected |
|----------|---------|----------|
| Explosions | Big and punchy / Restrained | Big and punchy |
| Enemy bullets | Pink/magenta + white core / Cyan / You decide | Pink/magenta + white core |
| Art style | Chunky low-poly military / Smoother stylized | **Smoother stylized** (overrode recommendation) |
| SFX | Crunchy arcade / Pure chiptune | Crunchy arcade |
| Model LOD | Detail per tier / One level | Detail per tier |
| Shake/hitstop | Bomb strong, death medium / Subtle / You decide | Bomb strong, death medium |
| Shake implementation | Render-only camera offset / Shake world | Render-only camera offset |
| Hit flash | White flash + spark / Flash only | White flash + spark |

## Claude's Discretion

- Weapon numbers, blink and invulnerability durations, gallery roster and spawn loop, lighting, particle, scorch and shadow techniques, protocol layout, exact shake and hitstop values.

## Deferred Ideas

- Lv5 MAX bonus points awarded once scoring exists (Phase 3).
- An X bomb alias was declined.
