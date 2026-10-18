"""The boss controller (ENMY-06, ENMY-07, ENMY-09): scripted rows plus a spec-driven fight.

A boss is ordinary ``EnemyPool`` rows (RESEARCH Pattern 4), so every weapon already damages
them. The controller moves its SCRIPTED rows, fires its emitters, owns the fight state and turns
a destroyed part into a stump. The game calls ``step`` before ``EnemyPool.step`` and ``settle``
after every damage pass and before ``remove_dead``. Rows are always found by uid with
``index_of_uid``, never by slot: a swap-remove moves slots.

The fight always ends (ENMY-09): it counts simulation steps from the end of the entrance, so
hitstop and pause freeze it, and at ``timeout_ticks`` the boss retreats; a destroyed hull plays a
fixed-length death sequence. Both end in GONE with every row removed.
"""

import math
from array import array
from dataclasses import dataclass, field
from typing import Final

from scorched_core.bosses.boss_spec import BossSpec
from scorched_core.bosses.boss_state import BossState
from scorched_core.clock.hitstop import Hitstop
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.events.event_ring import EventRing
from scorched_core.patterns.bullet_patterns import run_pattern
from scorched_core.patterns.pattern_library import PATTERN_TABLE
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import (
    BLAST_HUGE,
    BLAST_LARGE,
    BLAST_MEDIUM,
    EV_BOSS_DEFEATED,
    EV_BOSS_PHASE,
    EV_BOSS_RETREAT,
    EV_ENEMY_FIRE,
    EV_EXPLOSION,
    EV_PART_DESTROYED,
)
from scorched_core.tuning import (
    BOSS_PHASE_SHIELD_TICKS,
    BOSS_RETREAT_SPEED,
    BOSS_TIMER_SHOW_S,
    ENEMY_GROUND,
    ENEMY_MAX_ALIVE,
    HITSTOP_BOSS_TICKS,
    HITSTOP_PART_TICKS,
)

_VULNERABLE: Final = 0  # the shield value of a row that takes damage
_PERMANENT: Final = -1  # the shield value that never counts down
_STEPS_PER_SECOND: Final = 60
_RETREAT_EXIT_Y: Final = -80.0  # a retreating boss is removed once its lowest row is above this
_CHAIN_INTERVAL: Final = 15  # steps between the explosions of the death chain
# Fixed (no RNG) offsets from the hull centre for the chained explosions, cycled in order.
_CHAIN_OFFSETS: Final = (
    (0.0, 0.0),
    (-22.0, -12.0),
    (20.0, 10.0),
    (-10.0, 18.0),
    (24.0, -16.0),
    (4.0, -24.0),
)
_THRESHOLD_EPSILON: Final = 1e-6  # keeps an exact fraction (0.6 of 500) on its integer threshold


@dataclass(slots=True)
class BossController:
    """One boss fight: ``spec`` is the data and ``slot`` the boss slot (1 mid-boss, 2 boss).

    ``hull_uid`` and the per-part uids name the rows. Every per-part and per-emitter array is
    allocated once at construction (the emitter arrays are sized to the largest phase), so
    stepping allocates nothing. ``fight_ticks`` counts the simulation steps since the entrance
    ended. Phase thresholds are compared as integer hit points, so an exact fraction triggers.
    """

    spec: BossSpec
    slot: int
    state: BossState = field(default=BossState.ENTER, init=False)
    hull_uid: int = field(default=0, init=False)
    fight_ticks: int = field(default=0, init=False)
    _part_uids: array = field(init=False, repr=False)
    _part_alive: bytearray = field(init=False, repr=False)
    _parts_alive: int = field(default=0, init=False, repr=False)
    _threshold: array = field(init=False, repr=False)
    _emitter_timer: array = field(init=False, repr=False)
    _emitter_volley: array = field(init=False, repr=False)
    _emitter_burst: array = field(init=False, repr=False)
    _lowest_dy: float = field(default=0.0, init=False, repr=False)
    _phase: int = field(default=0, init=False, repr=False)
    _x: float = field(default=0.0, init=False, repr=False)
    _y: float = field(default=0.0, init=False, repr=False)
    _hull_hp: int = field(default=0, init=False, repr=False)
    _death_timer: int = field(default=0, init=False, repr=False)
    _destroyed: bool = field(default=False, init=False, repr=False)
    _started: bool = field(default=False, init=False, repr=False)

    def __post_init__(self) -> None:
        spec = self.spec
        count = len(spec.parts)
        self._part_uids = array("i", bytes(4 * count))
        self._part_alive = bytearray(count)
        self._threshold = array(
            "i", (int(p.hp_frac * spec.hull_hp + _THRESHOLD_EPSILON) for p in spec.phases)
        )
        slots = max(len(phase.emitters) for phase in spec.phases)
        self._emitter_timer = array("i", bytes(4 * slots))
        self._emitter_volley = array("i", bytes(4 * slots))
        self._emitter_burst = array("i", bytes(4 * slots))
        self._lowest_dy = max((part.dy for part in spec.parts), default=0.0)
        self._lowest_dy = max(self._lowest_dy, 0.0)
        self._hull_hp = spec.hull_hp

    @property
    def active(self) -> bool:
        """Return whether the boss is on the field: started and not yet gone."""
        return self._started and self.state is not BossState.GONE

    @property
    def gone(self) -> bool:
        """Return whether the fight is over and every row is removed."""
        return self.state is BossState.GONE

    @property
    def destroyed(self) -> bool:
        """Return whether the hull was destroyed (from the first step of its death sequence)."""
        return self._destroyed

    @property
    def phase_number(self) -> int:
        """Return the current attack phase, counting from 1."""
        return self._phase + 1

    @property
    def hp_fraction(self) -> float:
        """Return the hull's health as of the last settle, 1.0 down to 0.0."""
        return max(self._hull_hp, 0) / self.spec.hull_hp

    @property
    def seconds_left(self) -> int:
        """Return the whole seconds left before the timeout, or -1 when it is not worth showing.

        Only the fight has a countdown, and it is published only once ``BOSS_TIMER_SHOW_S``
        seconds or fewer remain. A partial second rounds up, so the last second reads 1.
        """
        if self.state is not BossState.FIGHT:
            return -1
        remaining = self.spec.timeout_ticks - self.fight_ticks
        if remaining > BOSS_TIMER_SHOW_S * _STEPS_PER_SECOND:
            return -1
        return -(-remaining // _STEPS_PER_SECOND)

    def part_uid(self, k: int) -> int:
        """Return the uid of part ``k``'s row (a part keeps its row as a stump)."""
        return int(self._part_uids[k])

    def start(self, enemies: EnemyPool) -> bool:
        """Spawn the shielded hull and parts above the screen; False (nothing spawned) if no room.

        Rows spawn SCRIPTED at the spec offsets from ``(x, enter_y)``, shielded for good until the
        entrance ends. The pool must have room for the whole boss: a half-spawned boss is refused.
        Starting again after the fight is gone begins a fresh fight.
        """
        spec = self.spec
        parts = spec.parts
        if enemies.n + 1 + len(parts) > ENEMY_MAX_ALIVE:
            return False
        enemies.spawn(
            spec.hull_kind,
            spec.x,
            spec.enter_y,
            MotionKind.SCRIPTED,
            0.0,
            0.0,
            hp=spec.hull_hp,
            radius=spec.hull_radius,
            shield=_PERMANENT,
        )
        self.hull_uid = int(enemies.uid[enemies.n - 1])
        for k in range(len(parts)):
            part = parts[k]
            enemies.spawn(
                part.kind,
                spec.x + part.dx,
                spec.enter_y + part.dy,
                MotionKind.SCRIPTED,
                0.0,
                0.0,
                hp=part.hp,
                radius=part.effective_radius,
                shield=_PERMANENT,
            )
            self._part_uids[k] = enemies.uid[enemies.n - 1]
            self._part_alive[k] = 1
        self._parts_alive = len(parts)
        self.state = BossState.ENTER
        self.fight_ticks = 0
        self._phase = 0
        self._x = spec.x
        self._y = spec.enter_y
        self._hull_hp = spec.hull_hp
        self._death_timer = 0
        self._destroyed = False
        self._started = True
        return True

    def step(
        self,
        enemies: EnemyPool,
        ebullets: BulletPool,
        ship_x: float,
        ship_y: float,
        events: EventRing,
    ) -> None:
        """Advance the fight one simulation step; a boss that is not on the field does nothing.

        ENTER descends to the hold line. FIGHT counts the step, sways the hull and fires the
        current phase's emitters at the ship. DYING plays the death chain and RETREAT rises
        off screen.
        """
        if not self.active:
            return
        state = self.state
        if state is BossState.ENTER:
            self._enter(enemies)
        elif state is BossState.FIGHT:
            self._fight(enemies, ebullets, ship_x, ship_y, events)
        elif state is BossState.DYING:
            self._die(events)
        else:
            self._retreat(enemies)

    def settle(
        self,
        enemies: EnemyPool,
        ebullets: BulletPool,
        events: EventRing,
        hitstop: Hitstop,
    ) -> int:
        """Resolve this step's damage after every damage pass; return the points to pay.

        This runs before ``remove_dead``, so a part at zero hp becomes a stump (1 hp, a permanent
        shield) instead of being removed, and a hull at zero hp starts its death sequence instead
        of vanishing. In the fight, parts settle first, then the hull's death, then the timeout
        (after damage, so a kill on the timeout step counts), then the phase.
        """
        state = self.state
        if state is BossState.FIGHT:
            return self._settle_fight(enemies, ebullets, events, hitstop)
        if state is BossState.DYING and self._death_timer >= self.spec.death_ticks:
            self._finish_death(enemies, ebullets, events, hitstop)
        return 0

    def _settle_fight(
        self, enemies: EnemyPool, ebullets: BulletPool, events: EventRing, hitstop: Hitstop
    ) -> int:
        points = 0
        parts = self.spec.parts
        for k in range(len(parts)):
            if not self._part_alive[k]:
                continue
            i = enemies.index_of_uid(int(self._part_uids[k]))
            if i < 0:
                self._part_alive[k] = 0  # the row left the pool: it can never count again
                self._parts_alive -= 1
            elif enemies.hp[i] <= 0:
                points += self._destroy_part(k, i, enemies, events, hitstop)
        h = enemies.index_of_uid(self.hull_uid)
        if h >= 0:
            self._hull_hp = int(enemies.hp[h])
        if h >= 0 and self._hull_hp <= 0:
            points += self._begin_death(enemies, h)
        elif self.fight_ticks >= self.spec.timeout_ticks:
            self._begin_retreat(enemies, events)
        else:
            self._advance_phase(enemies, ebullets, events)
        return points

    def _destroy_part(
        self, k: int, i: int, enemies: EnemyPool, events: EventRing, hitstop: Hitstop
    ) -> int:
        """Turn part ``k`` (row ``i``) into its stump, announce it and return its points."""
        part = self.spec.parts[k]
        enemies.become_stump(i, part.stump_kind)
        self._part_alive[k] = 0
        self._parts_alive -= 1
        x, y = float(enemies.x[i]), float(enemies.y[i])
        events.push(EV_EXPLOSION, x, y, BLAST_MEDIUM, ENEMY_GROUND[part.kind], part.stump_kind)
        events.push(EV_PART_DESTROYED, x, y, part.points, k, self.slot)
        hitstop.trigger(HITSTOP_PART_TICKS)
        return part.points

    def _advance_phase(self, enemies: EnemyPool, ebullets: BulletPool, events: EventRing) -> None:
        """Enter the deepest phase whose threshold the hull is at or below, or the all-parts one.

        Phases only go forward. Destroying every part while still in phase 1 enters phase 2 even
        at full health (D-11), but a boss with no parts never takes that rule and a single-phase
        boss has nowhere to go.
        """
        target = self._phase
        for k in range(len(self.spec.phases) - 1, self._phase, -1):
            if self._hull_hp <= self._threshold[k]:
                target = k
                break
        if self._phase == 0 and self.spec.parts and self._parts_alive == 0:
            target = max(target, 1)
        target = min(target, len(self.spec.phases) - 1)
        if target > self._phase:
            self._change_phase(target, enemies, ebullets, events)

    def _change_phase(
        self, target: int, enemies: EnemyPool, ebullets: BulletPool, events: EventRing
    ) -> None:
        """Switch to phase ``target``: one event, a short shield, clean bullets, fresh emitters."""
        self._phase = target
        events.push(EV_BOSS_PHASE, self._x, self._y, target + 1, self.slot)
        self._set_shield(enemies, self.hull_uid, BOSS_PHASE_SHIELD_TICKS)
        for k in range(len(self.spec.parts)):
            if self._part_alive[k]:  # a stump keeps its permanent shield
                self._set_shield(enemies, int(self._part_uids[k]), BOSS_PHASE_SHIELD_TICKS)
        ebullets.clear()
        self._restart_emitters()
        kind = self.spec.phases[target].hull_kind
        if kind is not None:
            i = enemies.index_of_uid(self.hull_uid)
            if i >= 0:
                enemies.kind[i] = kind

    def _restart_emitters(self) -> None:
        """Reset the current phase's emitters: each waits its pattern's delay, volley 0."""
        emitters = self.spec.phases[self._phase].emitters
        for k in range(len(emitters)):
            self._emitter_timer[k] = PATTERN_TABLE[emitters[k].pattern_id].delay
            self._emitter_volley[k] = 0
            self._emitter_burst[k] = 0

    def _begin_death(self, enemies: EnemyPool, hull: int) -> int:
        """Start the death sequence: rows shielded for good, the hull kept alive; pay the kill."""
        self.state = BossState.DYING
        self._destroyed = True
        self._death_timer = 0
        enemies.hp[hull] = 1  # remove_dead must not remove the hull before the sequence ends
        self._hull_hp = 0
        self._shield_all(enemies)
        return self.spec.kill_points

    def _begin_retreat(self, enemies: EnemyPool, events: EventRing) -> None:
        """Start the timeout retreat: rows shielded for good and silent, one event."""
        self.state = BossState.RETREAT
        self._shield_all(enemies)
        events.push(EV_BOSS_RETREAT, self._x, self._y, self.slot)

    def _finish_death(
        self, enemies: EnemyPool, ebullets: BulletPool, events: EventRing, hitstop: Hitstop
    ) -> None:
        """End the sequence: one huge explosion, the defeat event, clean bullets, rows removed."""
        events.push(EV_EXPLOSION, self._x, self._y, BLAST_HUGE, ENEMY_GROUND[self.spec.hull_kind])
        events.push(EV_BOSS_DEFEATED, self._x, self._y, self.slot)
        ebullets.clear()
        hitstop.trigger(HITSTOP_BOSS_TICKS)
        self._remove_rows(enemies)

    def _enter(self, enemies: EnemyPool) -> None:
        """Descend to the hold line; on arrival open the shields and start the fight."""
        spec = self.spec
        self._y = min(self._y + spec.enter_speed, spec.hold_y)
        self._place(enemies)
        if self._y >= spec.hold_y:
            self.state = BossState.FIGHT
            self._set_shield(enemies, self.hull_uid, _VULNERABLE)
            for k in range(len(spec.parts)):
                self._set_shield(enemies, int(self._part_uids[k]), _VULNERABLE)
            self._restart_emitters()

    def _fight(
        self,
        enemies: EnemyPool,
        ebullets: BulletPool,
        ship_x: float,
        ship_y: float,
        events: EventRing,
    ) -> None:
        """Count the step, sway the hull around its hold point and fire the phase's emitters."""
        self.fight_ticks += 1
        phase = self.spec.phases[self._phase]
        angle = math.tau * self.fight_ticks / phase.sway_period
        self._x = self.spec.x + phase.sway_x * math.sin(angle)
        self._y = self.spec.hold_y + phase.sway_y * math.sin(2.0 * angle)
        self._place(enemies)
        self._fire(ebullets, ship_x, ship_y, events)

    def _fire(self, ebullets: BulletPool, ship_x: float, ship_y: float, events: EventRing) -> None:
        """Fire every due emitter of the phase, in declared order, like ``EnemyPool.fire``.

        An emitter's timer starts at its pattern's delay and counts one per step; after a volley
        it reloads ``burst_gap`` while the burst has shots left, else ``interval``. A part's gun
        is skipped once that part is a stump. Each volley that spawned bullets pushes one
        low-priority ENEMY_FIRE event.
        """
        spec = self.spec
        emitters = spec.phases[self._phase].emitters
        timer, volley, burst = self._emitter_timer, self._emitter_volley, self._emitter_burst
        for k in range(len(emitters)):
            emitter = emitters[k]
            if emitter.part >= 0 and not self._part_alive[emitter.part]:
                continue
            if timer[k] > 1:
                timer[k] -= 1
                continue
            x = self._x + emitter.dx
            y = self._y + emitter.dy
            if emitter.part >= 0:
                x += spec.parts[emitter.part].dx
                y += spec.parts[emitter.part].dy
            pattern = PATTERN_TABLE[emitter.pattern_id]
            spawned = run_pattern(pattern, ebullets, x, y, ship_x, ship_y, volley[k])
            volley[k] += 1
            left = burst[k] - 1 if burst[k] > 0 else pattern.burst - 1
            burst[k] = left
            timer[k] = pattern.burst_gap if left > 0 else pattern.interval
            if spawned:
                events.push(EV_ENEMY_FIRE, x, y, pattern.shape, low=True)

    def _die(self, events: EventRing) -> None:
        """Push a low-priority LARGE explosion every ``_CHAIN_INTERVAL`` steps, then count on."""
        t = self._death_timer
        if t % _CHAIN_INTERVAL == 0:
            dx, dy = _CHAIN_OFFSETS[(t // _CHAIN_INTERVAL) % len(_CHAIN_OFFSETS)]
            kind = self.spec.hull_kind
            x, y = self._x + dx, self._y + dy
            events.push(EV_EXPLOSION, x, y, BLAST_LARGE, ENEMY_GROUND[kind], kind, low=True)
        self._death_timer = t + 1

    def _retreat(self, enemies: EnemyPool) -> None:
        """Rise at ``BOSS_RETREAT_SPEED``; remove all rows once the lowest one is above the exit."""
        self._y -= BOSS_RETREAT_SPEED
        self._place(enemies)
        if self._y + self._lowest_dy < _RETREAT_EXIT_Y:
            self._remove_rows(enemies)

    def _remove_rows(self, enemies: EnemyPool) -> None:
        """Remove the hull and every part row (no kill, no event) and end the fight."""
        enemies.remove_uid(self.hull_uid)
        for k in range(len(self.spec.parts)):
            enemies.remove_uid(int(self._part_uids[k]))
        self.state = BossState.GONE

    def _shield_all(self, enemies: EnemyPool) -> None:
        """Shield the hull and every part row for good (stumps already are)."""
        self._set_shield(enemies, self.hull_uid, _PERMANENT)
        for k in range(len(self.spec.parts)):
            self._set_shield(enemies, int(self._part_uids[k]), _PERMANENT)

    def _place(self, enemies: EnemyPool) -> None:
        """Write the hull's position and every part's offset position into their rows."""
        parts = self.spec.parts
        self._move(enemies, self.hull_uid, self._x, self._y)
        for k in range(len(parts)):
            part = parts[k]
            self._move(enemies, int(self._part_uids[k]), self._x + part.dx, self._y + part.dy)

    @staticmethod
    def _move(enemies: EnemyPool, uid: int, x: float, y: float) -> None:
        i = enemies.index_of_uid(uid)
        if i >= 0:
            enemies.x[i] = x
            enemies.y[i] = y

    @staticmethod
    def _set_shield(enemies: EnemyPool, uid: int, shield: int) -> None:
        i = enemies.index_of_uid(uid)
        if i >= 0:
            enemies.shield[i] = shield
