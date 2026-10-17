---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 2
total_count: 3
last_updated: 2026-10-17T16:32:02.611Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | stub | web/src/render/ship_model.js | 3 | Placeholder cone ship; plan 01-06 replaces it with the recognisable jet and hitbox marker | fixed |  | 2026-10-17T14:54:44.042Z | 2026-10-17T16:10:18.282Z |
| 2 | 01 | stub | web/src/render/renderer_rig.js | 23 | Stand-in flat ground plane and fixed camera distance; plan 01-05 replaces them with terrain and camera fit | fixed |  | 2026-10-17T14:54:44.170Z | 2026-10-17T15:56:13.957Z |
| 3 | 01 | stub | web/src/render/drone_instances.js | 1 | Drones are plain block placeholders (D-13) with a hit flash only; no destruction particles or explosions until a later plan | open |  | 2026-10-17T16:32:02.611Z |  |

````json
[
  {
    "id": 1,
    "kind": "stub",
    "phase": "01",
    "file": "web/src/render/ship_model.js",
    "line": 3,
    "description": "Placeholder cone ship; plan 01-06 replaces it with the recognisable jet and hitbox marker",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-17T14:54:44.042Z",
    "resolved_at": "2026-10-17T16:10:18.282Z",
    "milestone": null
  },
  {
    "id": 2,
    "kind": "stub",
    "phase": "01",
    "file": "web/src/render/renderer_rig.js",
    "line": 23,
    "description": "Stand-in flat ground plane and fixed camera distance; plan 01-05 replaces them with terrain and camera fit",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-17T14:54:44.170Z",
    "resolved_at": "2026-10-17T15:56:13.957Z",
    "milestone": null
  },
  {
    "id": 3,
    "kind": "stub",
    "phase": "01",
    "file": "web/src/render/drone_instances.js",
    "line": 1,
    "description": "Drones are plain block placeholders (D-13) with a hit flash only; no destruction particles or explosions until a later plan",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-17T16:32:02.611Z",
    "resolved_at": null,
    "milestone": null
  }
]
````
