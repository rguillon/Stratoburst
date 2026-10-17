# Phase 1: Playable Core on Real Devices - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-17
**Phase:** 01-playable-core-on-real-devices
**Areas discussed:** Hosting & sharing, Playfield & camera framing, Ship feel & placeholder look
**Offered but not selected:** Go/no-go test & devices

---

## Hosting & sharing

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Pages | Free, Action deploy, no custom headers, gzip only | ✓ |
| Cloudflare Pages | `_headers`, automatic Brotli, needs account | |
| itch.io | Gamer page, iframe friction on mobile, manual zips | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| jsDelivr CDN | Brotli, likely cached, tiny deploy | ✓ |
| Self-host in dist/ | Self-contained, larger on gzip host | |
| CDN now, self-host in Phase 4 | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Every push to main | CI gate then deploy | |
| Manual / tagged releases | | |
| Main = live, plus PR previews | More CI setup | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Not yet, set it up in Phase 1 | | |
| Yes, already exists | | |
| I'll create it myself | Plan tells user what to configure | ✓ |

**Notes:** Claude noted that GitHub Pages has no native PR previews. The researcher should choose a subfolder-on-`gh-pages` approach.

---

## Playfield & camera framing

| Option | Description | Selected |
|--------|-------------|----------|
| 3:4 arcade | ~240×320, Raiden ratio | ✓ |
| 9:16 phone-tall | | |
| 2:3 compromise | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Dimmed terrain continues | Modern look, small fill cost | ✓ |
| Black bars | | |
| Decorative frame/bezel | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Modest ~20-30° | Readable hitboxes, Raiden IV style | ✓ |
| Strong ~40-50° | | |
| Tunable, decide by feel | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Fully fixed | | ✓ |
| Slight horizontal sway | | |

---

## Ship feel & placeholder look

| Option | Description | Selected |
|--------|-------------|----------|
| Raiden-like, ~1.2 s to cross | Instant start/stop, tunable | ✓ |
| Faster, ~0.8 s | | |
| Slower + focus key | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Space/J fire, Shift/K bomb | Physical keys, Esc/P pause | ✓ |
| Z fire, X bomb | | |
| Both sets | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Simple but recognizable | Low-poly jet, blocks, flat terrain | ✓ |
| Pure primitives | | |
| First real procedural models | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Drifting drones | Air targets, flash and vanish | ✓ |
| Static ground blocks | | |
| Both | | |

| Option | Description | Selected |
|--------|-------------|----------|
| 1:1 with same speed cap | Excess finger delta caught up later | ✓ |
| Pure 1:1, no cap | | |
| Adjustable sensitivity | | |

| Option | Description | Selected |
|--------|-------------|----------|
| URL flags | `?debug`, `?stress=N`, `?tier=` | ✓ |
| Hidden gesture/key | | |
| Both | | |

---

## Claude's Discretion

- Exact camera angle/FOV, scroll speed, fire rate/shot pattern, drone HP/spawn rate
- Quality-tier ladder and auto step-down heuristic
- Loading screen / error panel style
- Go/no-go measurement method (defaults to ROADMAP criterion 3; user runs it on their own phones)

## Deferred Ideas

- Self-hosting Pyodide (Phase 4 / PWA)
- Touch sensitivity option (Phase 4 options)
- Focus/slow-movement key (not in v1)
