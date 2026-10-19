---
status: complete
phase: 02-arcade-shooting-feel
source: [02-VERIFICATION.md]
started: 2026-10-18T12:47:40Z
updated: 2026-10-18T13:10:56.039Z
---

## Current Test

[testing complete]

## Tests

### 1. Visual look of the full effect stack (bloom, dynamic light, particles, ship and enemy models, smooth vs faceted, tier=low fallback)
expected: Models look smooth and stylised with glowing engines; explosions are sized by class with fire, smoke and debris; ground kills leave charred wrecks and scorch marks; air units cast offset shadows that read as altitude; nothing strobes
result: pass

### 2. Pink enemy bullets stay readable over fire, smoke and bloom on tier high, mid and low
expected: Enemy bullets are clearly distinguishable in the middle of a bomb fireball and chained explosions on every tier
result: pass

### 3. Shooting feel: shot snappiness, hit flash, hitstop and shake weight on bomb detonation and player death; ordinary hits do not shake or freeze
expected: Bomb: instant freeze plus ~0.5 s hard shake. Death: short freeze plus medium shake. Ordinary hits and kills: neither
result: pass

### 4. Audio quality on desktop: shots quieter than explosions, explosion thump grows with class, pickups chime, MAX special, bomb whoosh and boom, death crunch, laser hum only while firing, pause silences all
expected: Every listed sound audible, balanced and not noisy under heavy fire
result: pass

### 5. iOS audio after the start tap, itemised: (a) ringer ON, (b) ringer OFF / silent switch, (c) after switching apps and back; in Safari proper
expected: Sound plays in all three conditions
result: pass

### 6. Touch bomb button ergonomics: portrait (below the playfield, right) and landscape (right margin), thumb reach, not under notch or home bar, steering with one finger while tapping with another
expected: Button is large, reachable, never hidden, and a tap fires exactly one bomb
result: pass

### 7. ANDROID (waived, never measured): baseline and worst-case 5-minute runs on a mid-range Android phone, plus the feel checklist and the touch bomb button
expected: avg fps >= 29, p95 frame <= 40 ms, worst minute >= 29, final tier keeps bloom (ROADMAP Phase 2 criterion 4: 'both phones')
result: skipped
reason: "Deferred follow-up: user accepted the Android gap and moved on (2026-10-18)"

### 8. Forced tier runs: ?tier=low and ?tier=high, 2 minutes each, on desktop and iPhone (research assumption A11)
expected: Frame time and tick recorded for comparison; tier=low keeps readability, tier=high holds frame rate on phones
result: pass

### 9. Phone worst-case protocol detail: a bomb about every 30 s
expected: The report flags show bombs=default; whether the user actually bombed every ~30 s was not stated
result: pass

## Summary

total: 9
passed: 8
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

## Deferred Follow-Ups

- test: 7
  idea: "Accepted Android gap: measure on a mid-range Android phone (avg fps >= 29, p95 <= 40 ms, bloom kept) or amend ROADMAP Phase 2 criterion 4"
  deferred_at: 2026-10-18
