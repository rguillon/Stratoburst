import math
from array import array

import pytest

from scorched_core.bosses.boss_controller import BossController
from scorched_core.bosses.boss_spec import BossSpec
from scorched_core.bosses.boss_state import BossState
from scorched_core.bosses.emitter_spec import EmitterSpec
from scorched_core.bosses.part_spec import PartSpec
from scorched_core.bosses.phase_spec import PhaseSpec
from scorched_core.clock.hitstop import Hitstop
from scorched_core.collision.circle_hits import resolve_shots_vs_enemies
from scorched_core.collision.uniform_grid import UniformGrid
from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.events.event_ring import EventRing
from scorched_core.patterns.pattern_library import PATTERN_TABLE, pattern_index
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import (
    BLAST_HUGE,
    BLAST_LARGE,
    BLAST_MEDIUM,
    ENEMY_CAP,
    EV_BOSS_DEFEATED,
    EV_BOSS_PHASE,
    EV_BOSS_RETREAT,
    EV_ENEMY_FIRE,
    EV_EXPLOSION,
    EV_PART_DESTROYED,
    EVENT_SOFT_CAP,
    EVENT_STRIDE,
    PLAYFIELD_H,
    PLAYFIELD_W,
)
from scorched_core.tuning import (
    BOSS_PHASE_SHIELD_TICKS,
    BOSS_RETREAT_SPEED,
    ENEMY_GROUND,
    ENEMY_MAX_ALIVE,
    GRID_CELL,
    HITSTOP_BOSS_TICKS,
    HITSTOP_PART_TICKS,
)

SHIP_X = 120.0
SHIP_Y = 272.0
HOLD_Y = 80.0
PART_POINTS = 1500
DX = 36.0  # clear of the hull circle (28 + 2 < 37.4), so a bolt at a part hits the part


TURRET_PATTERN = PATTERN_TABLE[pattern_index("train_turret_aimed")]
HULL_PATTERN = PATTERN_TABLE[pattern_index("train_hull_spread")]


def default_phases() -> tuple[PhaseSpec, ...]:
    guns = (
        EmitterSpec("train_turret_aimed", part=0),
        EmitterSpec("train_turret_aimed", part=1),
        EmitterSpec("train_hull_spread", dy=20.0),
    )
    return (
        PhaseSpec(1.0, guns),
        PhaseSpec(0.6, (EmitterSpec("train_hull_spread", dy=20.0),)),
        PhaseSpec(0.25, (EmitterSpec("train_hull_spread", dy=20.0),)),
    )


def turret(dx: float, dy: float = 10.0) -> PartSpec:
    return PartSpec(EnemyKind.TRAIN_TURRET, dx, dy, 30, PART_POINTS, EnemyKind.TRAIN_STUMP)


def make_spec(**overrides: object) -> BossSpec:
    fields: dict[str, object] = {
        "hull_kind": EnemyKind.TRAIN,
        "hull_hp": 500,
        "hull_radius": 28.0,
        "x": 120.0,
        "enter_y": -60.0,
        "hold_y": HOLD_Y,
        "enter_speed": 2.0,
        "parts": (turret(-DX), turret(DX)),
        "timeout_ticks": 600,
        "kill_points": 20000,
        "death_ticks": 60,
        "phases": default_phases(),
    }
    return BossSpec(**{**fields, **overrides})  # type: ignore[arg-type]


class Rig:
    """A controller with the pools it drives, stepped in the game's order."""

    def __init__(self, spec: BossSpec | None = None, slot: int = 1, bullets: int = 400) -> None:
        self.spec = spec or make_spec()
        self.controller = BossController(self.spec, slot)
        self.enemies = EnemyPool()
        self.bullets = BulletPool(bullets)
        self.events = EventRing()
        self.hitstop = Hitstop()
        self.grid = UniformGrid(PLAYFIELD_W, PLAYFIELD_H, GRID_CELL, ENEMY_CAP)
        self.scratch = array("i", bytes(4 * ENEMY_CAP))
        self.points = 0

    def start(self) -> bool:
        return self.controller.start(self.enemies)

    def step(self) -> int:
        """One game step: controller step, pool step, controller settle, remove_dead."""
        self.events.clear()
        self.controller.step(self.enemies, self.bullets, SHIP_X, SHIP_Y, self.events)
        self.enemies.step(SHIP_X, SHIP_Y)
        paid = self.controller.settle(self.enemies, self.bullets, self.events, self.hitstop)
        self.enemies.remove_dead(self.events)
        self.points += paid
        return paid

    def run(self, steps: int) -> None:
        for _ in range(steps):
            self.step()

    def enter(self) -> None:
        """Start the controller and step until the entrance ends."""
        assert self.start()
        while self.controller.state is BossState.ENTER:
            self.step()

    def row(self, uid: int) -> int:
        i = self.enemies.index_of_uid(uid)
        assert i >= 0
        return i

    def hull(self) -> int:
        return self.row(self.controller.hull_uid)

    def part(self, k: int) -> int:
        return self.row(self.controller.part_uid(k))

    def kill_part(self, k: int) -> None:
        """Damage a part to zero with a real bolt through the grid, like the player's vulcan."""
        i = self.part(k)
        self.enemies.hp[i] = 1
        self.grid.rebuild(self.enemies.x, self.enemies.y, self.enemies.n)
        shots = BulletPool(4)
        shots.spawn(self.enemies.x[i], self.enemies.y[i], 0.0, 0.0)
        hits = resolve_shots_vs_enemies(
            shots, self.enemies, self.grid, self.scratch, 1, self.events
        )
        assert hits == 1
        assert self.enemies.hp[i] == 0

    def events_of(self, kind: int) -> list[tuple[float, ...]]:
        buf = self.events.buf
        found = []
        for e in range(self.events.n):
            base = e * EVENT_STRIDE
            if buf[base] == kind:
                found.append(tuple(buf[base + 1 : base + EVENT_STRIDE]))
        return found


def test_a_new_controller_is_not_active_until_it_starts() -> None:
    rig = Rig()
    assert not rig.controller.active
    assert not rig.controller.gone
    rig.step()  # a no-op, not an error
    assert rig.enemies.n == 0


def test_start_spawns_a_shielded_scripted_hull_and_parts_at_the_spec_offsets() -> None:
    rig = Rig()
    assert rig.start()
    assert rig.controller.active
    assert rig.controller.state is BossState.ENTER
    assert rig.enemies.n == 3
    h = rig.hull()
    assert rig.enemies.kind[h] == EnemyKind.TRAIN
    assert (rig.enemies.x[h], rig.enemies.y[h]) == (120.0, -60.0)
    assert (rig.enemies.hp[h], rig.enemies.hp_max[h], rig.enemies.radius[h]) == (500, 500, 28.0)
    for k, dx in enumerate((-DX, DX)):
        p = rig.part(k)
        assert rig.enemies.kind[p] == EnemyKind.TRAIN_TURRET
        assert (rig.enemies.x[p], rig.enemies.y[p]) == (120.0 + dx, -50.0)
        assert (rig.enemies.hp[p], rig.enemies.hp_max[p]) == (30, 30)
    for i in range(3):
        assert rig.enemies.motion[i] == MotionKind.SCRIPTED
        assert rig.enemies.shield[i] == -1


def test_start_refuses_when_the_pool_has_no_room_for_the_whole_boss() -> None:
    rig = Rig()
    for _ in range(ENEMY_MAX_ALIVE - 2):  # one slot short of hull plus two parts
        rig.enemies.spawn(EnemyKind.JET, 10.0, 10.0, MotionKind.DIVE, 0.0, 0.0)
    before = rig.enemies.n
    assert not rig.start()
    assert rig.enemies.n == before
    assert not rig.controller.active


def test_the_entrance_descends_at_enter_speed_with_the_parts_following_the_hull() -> None:
    rig = Rig()
    assert rig.start()
    rig.run(5)
    h = rig.hull()
    assert rig.enemies.y[h] == pytest.approx(-60.0 + 5 * 2.0)
    p = rig.part(1)
    assert rig.enemies.y[p] == pytest.approx(-60.0 + 10.0 + 5 * 2.0)
    assert rig.enemies.x[p] == pytest.approx(120.0 + DX)
    assert rig.controller.state is BossState.ENTER


def test_the_entrance_ends_exactly_on_the_hold_line_then_the_fight_opens_the_shields() -> None:
    rig = Rig()
    assert rig.start()
    steps = int((HOLD_Y - -60.0) / 2.0)
    rig.run(steps - 1)
    assert rig.controller.state is BossState.ENTER
    assert rig.enemies.shield[rig.hull()] == -1
    rig.step()
    assert rig.controller.state is BossState.FIGHT
    assert rig.enemies.y[rig.hull()] == HOLD_Y
    for i in range(rig.enemies.n):
        assert rig.enemies.shield[i] == 0


def test_an_entrance_speed_that_overshoots_clamps_to_the_hold_line() -> None:
    rig = Rig(make_spec(enter_speed=100.0))
    rig.enter()
    assert rig.enemies.y[rig.hull()] == HOLD_Y


def test_a_spec_that_starts_on_the_hold_line_opens_the_fight_on_the_first_step() -> None:
    rig = Rig(make_spec(enter_y=HOLD_Y))
    assert rig.start()
    rig.step()
    assert rig.controller.state is BossState.FIGHT


def test_in_the_fight_the_hull_holds_still_and_the_parts_keep_their_offsets() -> None:
    rig = Rig()
    rig.enter()
    rig.run(30)
    h = rig.hull()
    assert (rig.enemies.x[h], rig.enemies.y[h]) == (120.0, HOLD_Y)
    p = rig.part(0)
    assert (rig.enemies.x[p], rig.enemies.y[p]) == (120.0 - DX, HOLD_Y + 10.0)


def test_the_boss_rows_are_never_removed_by_the_pools_exit_margins() -> None:
    rig = Rig()
    assert rig.start()
    assert rig.enemies.y[rig.hull()] < 0.0  # well above the playfield
    rig.run(3)
    assert rig.enemies.n == 3


def test_the_hull_hp_fraction_tracks_the_damage_it_took() -> None:
    rig = Rig()
    rig.enter()
    assert rig.controller.hp_fraction == 1.0
    rig.enemies.hp[rig.hull()] = 125
    rig.step()
    assert rig.controller.hp_fraction == pytest.approx(0.25)


def test_a_shot_at_a_part_during_the_entrance_does_nothing() -> None:
    rig = Rig()
    assert rig.start()
    rig.run(3)
    p = rig.part(0)
    rig.enemies.apply_hit(p, 999, rig.events)
    assert rig.enemies.hp[p] == 30


def test_a_destroyed_part_becomes_a_stump_pays_its_points_and_asks_for_hitstop() -> None:
    rig = Rig()
    rig.enter()
    uid = rig.controller.part_uid(0)
    rig.kill_part(0)
    x, y = float(rig.enemies.x[rig.part(0)]), float(rig.enemies.y[rig.part(0)])
    rig.events.clear()
    paid = rig.controller.settle(rig.enemies, rig.bullets, rig.events, rig.hitstop)
    assert paid == PART_POINTS
    i = rig.part(0)
    assert rig.enemies.uid[i] == uid
    assert rig.enemies.kind[i] == EnemyKind.TRAIN_STUMP
    assert (rig.enemies.hp[i], rig.enemies.shield[i]) == (1, -1)
    assert rig.hitstop.ticks == HITSTOP_PART_TICKS
    (boom,) = rig.events_of(EV_EXPLOSION)
    assert boom[:2] == (x, y)
    assert boom[2] == BLAST_MEDIUM
    assert boom[3] == float(ENEMY_GROUND[EnemyKind.TRAIN_TURRET])
    assert boom[4] == EnemyKind.TRAIN_STUMP
    (gone,) = rig.events_of(EV_PART_DESTROYED)
    assert gone == (x, y, PART_POINTS, 0.0, 1.0)


def test_the_stump_stays_after_remove_dead_and_follows_the_hull() -> None:
    rig = Rig()
    rig.enter()
    rig.kill_part(1)
    rig.step()
    rig.run(10)
    i = rig.part(1)
    assert rig.enemies.kind[i] == EnemyKind.TRAIN_STUMP
    assert rig.enemies.n == 3
    assert (rig.enemies.x[i], rig.enemies.y[i]) == (120.0 + DX, HOLD_Y + 10.0)
    assert rig.enemies.kills == 0


def test_a_stump_never_counts_again_and_takes_no_damage() -> None:
    rig = Rig()
    rig.enter()
    rig.kill_part(0)
    assert rig.step() == PART_POINTS
    i = rig.part(0)
    rig.enemies.apply_hit(i, 50, rig.events)
    assert rig.enemies.hp[i] == 1
    assert rig.step() == 0
    assert rig.step() == 0
    assert rig.points == PART_POINTS


def test_two_parts_destroyed_on_one_step_pay_both_and_trigger_one_hitstop_value() -> None:
    rig = Rig()
    rig.enter()
    rig.kill_part(0)
    rig.kill_part(1)
    assert rig.step() == 2 * PART_POINTS
    assert rig.hitstop.ticks == HITSTOP_PART_TICKS
    assert len(rig.events_of(EV_PART_DESTROYED)) == 2


def test_parts_are_tracked_by_uid_across_a_swap_remove() -> None:
    rig = Rig()
    rig.enemies.spawn(EnemyKind.JET, 10.0, 10.0, MotionKind.DIVE, 0.0, 0.0)  # slot 0
    rig.enter()
    rig.enemies._remove_at(0)  # the last row (a part) takes slot 0
    rig.kill_part(0)
    assert rig.step() == PART_POINTS
    assert rig.enemies.kind[rig.part(0)] == EnemyKind.TRAIN_STUMP


def test_the_controller_never_reads_a_slot_that_a_part_row_left() -> None:
    rig = Rig()
    rig.enter()
    rig.enemies.remove_uid(rig.controller.part_uid(0))  # some other system removed the row
    rig.step()  # must not raise or settle a stranger
    assert rig.enemies.n == 2


def test_the_hull_row_is_a_normal_target_for_every_damage_path() -> None:
    rig = Rig()
    rig.enter()
    h = rig.hull()
    rig.enemies.apply_hit(h, 40, rig.events)
    assert rig.enemies.hp[h] == 460
    rig.step()
    assert rig.controller.hp_fraction == pytest.approx(460 / 500)


def test_a_hull_row_spawned_by_the_controller_never_exceeds_the_grid_limit() -> None:
    rig = Rig()
    assert rig.start()
    biggest = max(rig.enemies.radius[i] for i in range(rig.enemies.n))
    assert biggest + 2.5 <= GRID_CELL
    assert math.isfinite(biggest)


def test_a_hull_row_that_vanished_is_skipped_and_the_fight_goes_on() -> None:
    rig = Rig()
    rig.enter()
    rig.enemies.remove_uid(rig.controller.hull_uid)
    rig.run(3)  # neither the follow nor the settle may read a stranger's slot
    assert rig.controller.active
    assert rig.controller.hp_fraction == 1.0
    assert rig.enemies.n == 2


def test_rows_that_vanish_during_the_entrance_do_not_break_the_opening_of_the_fight() -> None:
    rig = Rig()
    assert rig.start()
    rig.enemies.remove_uid(rig.controller.hull_uid)
    rig.enemies.remove_uid(rig.controller.part_uid(0))
    while rig.controller.state is BossState.ENTER:
        rig.step()
    assert rig.enemies.shield[rig.part(1)] == 0


# --- phases (ENMY-06, D-10, D-11) ---


def hit_hull_to(rig: Rig, hp: int) -> None:
    rig.enemies.hp[rig.hull()] = hp


def test_the_fight_opens_in_phase_one() -> None:
    rig = Rig()
    assert rig.start()
    assert rig.controller.phase_number == 1
    rig.enter()
    assert rig.controller.phase_number == 1
    assert rig.events_of(EV_BOSS_PHASE) == []


def test_a_hull_fraction_just_above_a_threshold_stays_in_the_phase() -> None:
    rig = Rig()
    rig.enter()
    hit_hull_to(rig, 305)  # 0.61
    rig.step()
    assert rig.controller.phase_number == 1
    assert rig.events_of(EV_BOSS_PHASE) == []


def test_a_hull_fraction_exactly_on_a_threshold_enters_that_phase_with_one_event() -> None:
    rig = Rig()
    rig.enter()
    hit_hull_to(rig, 300)  # exactly 0.6
    rig.step()
    assert rig.controller.phase_number == 2
    (event,) = rig.events_of(EV_BOSS_PHASE)
    assert event[2] == 2.0
    assert event[3] == 1.0  # the boss slot
    assert (event[0], event[1]) == (120.0, HOLD_Y)
    rig.step()
    assert rig.events_of(EV_BOSS_PHASE) == []  # one event per change, not one per step


def test_one_big_hit_jumps_straight_to_the_deepest_phase_with_one_event() -> None:
    rig = Rig()
    rig.enter()
    hit_hull_to(rig, 350)
    rig.step()
    assert rig.controller.phase_number == 1  # 0.7 is above the second threshold
    hit_hull_to(rig, 100)  # 0.2
    rig.step()
    assert rig.controller.phase_number == 3
    (event,) = rig.events_of(EV_BOSS_PHASE)
    assert event[2] == 3.0


def test_a_phase_never_goes_back_when_the_hull_is_somehow_healed() -> None:
    rig = Rig()
    rig.enter()
    hit_hull_to(rig, 290)
    rig.step()
    hit_hull_to(rig, 500)
    rig.run(3)
    assert rig.controller.phase_number == 2


def test_destroying_every_part_enters_phase_two_even_at_full_hull_health() -> None:
    rig = Rig()
    rig.enter()
    rig.kill_part(0)
    rig.step()
    assert rig.controller.phase_number == 1  # one part is still alive
    rig.kill_part(1)
    rig.step()
    assert rig.controller.phase_number == 2
    assert rig.controller.hp_fraction == 1.0
    assert len(rig.events_of(EV_BOSS_PHASE)) == 1


def test_the_last_part_and_the_threshold_on_one_step_give_a_single_transition() -> None:
    rig = Rig()
    rig.enter()
    rig.kill_part(0)
    rig.step()
    rig.kill_part(1)
    hit_hull_to(rig, 290)
    rig.step()
    assert rig.controller.phase_number == 2
    assert len(rig.events_of(EV_BOSS_PHASE)) == 1


def test_the_all_parts_rule_only_applies_from_phase_one() -> None:
    rig = Rig()
    rig.enter()
    hit_hull_to(rig, 100)
    rig.step()
    assert rig.controller.phase_number == 3
    rig.run(BOSS_PHASE_SHIELD_TICKS)  # the transition shield wears off
    rig.kill_part(0)
    rig.kill_part(1)
    rig.step()
    assert rig.controller.phase_number == 3  # not pulled back to phase two


def test_a_spec_with_no_parts_never_takes_the_all_parts_rule() -> None:
    hull_only = (PhaseSpec(1.0, ()), PhaseSpec(0.6, ()))
    rig = Rig(make_spec(parts=(), phases=hull_only))
    rig.enter()
    rig.run(20)
    assert rig.controller.phase_number == 1
    assert rig.events_of(EV_BOSS_PHASE) == []


def test_a_single_phase_spec_never_transitions() -> None:
    only = (PhaseSpec(1.0, (EmitterSpec("train_hull_spread"),)),)
    rig = Rig(make_spec(phases=only))
    rig.enter()
    rig.kill_part(0)
    rig.kill_part(1)
    hit_hull_to(rig, 10)
    rig.run(3)
    assert rig.controller.phase_number == 1
    assert rig.events_of(EV_BOSS_PHASE) == []


def test_a_transition_shields_every_live_row_clears_enemy_bullets_and_restarts_the_emitters() -> (
    None
):
    rig = Rig()
    rig.enter()
    rig.kill_part(0)
    rig.step()
    rig.bullets.spawn(10.0, 10.0, 0.0, 1.0)
    hit_hull_to(rig, 290)
    rig.step()
    assert rig.controller.phase_number == 2
    assert rig.bullets.n == 0
    assert rig.enemies.shield[rig.hull()] == BOSS_PHASE_SHIELD_TICKS
    assert rig.enemies.shield[rig.part(1)] == BOSS_PHASE_SHIELD_TICKS
    assert rig.enemies.shield[rig.part(0)] == -1  # the stump keeps its permanent shield
    delay = HULL_PATTERN.delay
    rig.run(delay - 1)
    assert rig.bullets.n == 0  # the emitter restarted from its pattern delay
    rig.step()
    assert rig.bullets.n == HULL_PATTERN.count


def test_the_phase_shield_wears_off_after_its_ticks() -> None:
    rig = Rig()
    rig.enter()
    hit_hull_to(rig, 290)
    rig.step()
    h = rig.hull()
    rig.enemies.apply_hit(h, 10, rig.events)
    assert rig.enemies.hp[h] == 290
    rig.run(BOSS_PHASE_SHIELD_TICKS)
    assert rig.enemies.shield[h] == 0
    rig.enemies.apply_hit(h, 10, rig.events)
    assert rig.enemies.hp[h] == 280


def test_a_new_phase_may_swap_the_hull_row_kind() -> None:
    swap = (
        PhaseSpec(1.0, ()),
        PhaseSpec(0.6, (), hull_kind=EnemyKind.TRAIN_TURRET),
        PhaseSpec(0.25, ()),
    )
    rig = Rig(make_spec(phases=swap))
    rig.enter()
    hit_hull_to(rig, 290)
    rig.step()
    assert rig.enemies.kind[rig.hull()] == EnemyKind.TRAIN_TURRET
    hit_hull_to(rig, 100)
    rig.step()
    assert rig.enemies.kind[rig.hull()] == EnemyKind.TRAIN_TURRET  # no kind: left as it was


def test_a_phase_change_with_a_hull_kind_survives_a_vanished_hull_row() -> None:
    swap = (PhaseSpec(1.0, ()), PhaseSpec(0.6, (), hull_kind=EnemyKind.TRAIN_TURRET))
    rig = Rig(make_spec(phases=swap))
    rig.enter()
    rig.enemies.remove_uid(rig.controller.hull_uid)
    rig.kill_part(0)
    rig.kill_part(1)
    rig.step()
    assert rig.controller.phase_number == 2  # the all-parts rule, with no hull row to re-kind


# --- emitters ---


def fire_step(rig: Rig) -> None:
    """Run to the step on which the first volley of a freshly opened fight leaves."""
    rig.run(TURRET_PATTERN.delay)


def test_nothing_fires_during_the_entrance_or_before_the_pattern_delay() -> None:
    rig = Rig()
    assert rig.start()
    rig.run(10)
    assert rig.bullets.n == 0
    while rig.controller.state is BossState.ENTER:
        rig.step()
    rig.run(TURRET_PATTERN.delay - 1)
    assert rig.bullets.n == 0


def test_emitters_fire_in_their_declared_order_from_their_own_muzzles() -> None:
    rig = Rig()
    rig.enter()
    fire_step(rig)
    # two aimed shots (one per turret, in declared order), then the hull's fan
    assert rig.bullets.n == 2 + HULL_PATTERN.count
    assert rig.bullets.x[0] == pytest.approx(120.0 - DX)
    assert rig.bullets.y[0] == pytest.approx(HOLD_Y + 10.0)
    assert rig.bullets.x[1] == pytest.approx(120.0 + DX)
    assert rig.bullets.x[2] == pytest.approx(120.0)
    assert rig.bullets.y[2] == pytest.approx(HOLD_Y + 20.0)  # hull + (dx, dy)


def test_each_volley_pushes_one_low_priority_enemy_fire_event_with_the_shape() -> None:
    rig = Rig()
    rig.enter()
    fire_step(rig)
    fires = rig.events_of(EV_ENEMY_FIRE)
    assert len(fires) == 3
    assert fires[0][2] == float(TURRET_PATTERN.shape)
    assert fires[2][2] == float(HULL_PATTERN.shape)


def test_enemy_fire_events_are_low_priority_so_a_busy_ring_refuses_them() -> None:
    rig = Rig()
    rig.enter()
    rig.run(TURRET_PATTERN.delay - 1)
    rig.events.clear()
    for _ in range(EVENT_SOFT_CAP):
        rig.events.push(EV_EXPLOSION, 0.0, 0.0)
    dropped = rig.events.dropped
    rig.controller.step(rig.enemies, rig.bullets, SHIP_X, SHIP_Y, rig.events)
    assert rig.bullets.n == 2 + HULL_PATTERN.count  # the volleys still fly
    assert rig.events.n == EVENT_SOFT_CAP  # but their events were refused
    assert rig.events.dropped == dropped + 3


def test_a_volley_that_spawned_nothing_pushes_no_event() -> None:
    rig = Rig(bullets=0)
    rig.enter()
    fire_step(rig)
    assert rig.bullets.n == 0
    assert rig.events_of(EV_ENEMY_FIRE) == []


def test_an_emitter_repeats_every_pattern_interval() -> None:
    rig = Rig()
    rig.enter()
    fire_step(rig)
    first = rig.bullets.n
    rig.run(TURRET_PATTERN.interval - 1)
    assert rig.bullets.n == first  # the turrets' next shot is not due yet (the fan is slower)
    rig.step()
    assert rig.bullets.n == first + 2


def test_a_burst_pattern_fires_its_shots_a_gap_apart_then_waits_the_interval() -> None:
    stream = PATTERN_TABLE[pattern_index("stream3")]
    phases = (PhaseSpec(1.0, (EmitterSpec("stream3"),)),)
    rig = Rig(make_spec(phases=phases))
    rig.enter()
    rig.run(stream.delay)
    assert rig.bullets.n == 1
    rig.run(stream.burst_gap)
    assert rig.bullets.n == 2
    rig.run(stream.burst_gap)
    assert rig.bullets.n == 3
    rig.run(stream.interval - 1)
    assert rig.bullets.n == 3
    rig.step()
    assert rig.bullets.n == 4


def test_a_part_emitter_stops_once_its_part_is_a_stump() -> None:
    rig = Rig()
    rig.enter()
    rig.kill_part(0)
    rig.step()
    rig.bullets.clear()
    rig.run(TURRET_PATTERN.delay)
    # the surviving turret and the fan fire; the stump's turret does not
    xs = {round(float(rig.bullets.x[i]), 3) for i in range(2)}
    assert rig.bullets.n == 1 + HULL_PATTERN.count
    assert round(120.0 - DX, 3) not in xs
    assert round(120.0 + DX, 3) in xs


def test_the_emitters_follow_a_swaying_hull() -> None:
    phases = (
        PhaseSpec(
            1.0,
            (EmitterSpec("train_hull_spread"),),
            sway_x=10.0,
            sway_period=HULL_PATTERN.delay * 4,
        ),
    )
    rig = Rig(make_spec(phases=phases))
    rig.enter()
    rig.run(HULL_PATTERN.delay)  # a quarter period: the sway is at its peak
    assert rig.bullets.x[HULL_PATTERN.count // 2] == pytest.approx(130.0, abs=0.01)


# --- sway ---


def test_the_hull_sways_around_its_hold_point_and_the_parts_follow() -> None:
    phases = (PhaseSpec(1.0, (), sway_x=10.0, sway_y=6.0, sway_period=120),)
    rig = Rig(make_spec(phases=phases))
    rig.enter()
    rig.run(15)  # an eighth of a period
    h = rig.hull()
    assert rig.enemies.x[h] == pytest.approx(120.0 + 10.0 * math.sin(math.pi / 4))
    assert rig.enemies.y[h] == pytest.approx(HOLD_Y + 6.0)
    p = rig.part(0)
    assert rig.enemies.x[p] == pytest.approx(rig.enemies.x[h] - DX)
    assert rig.enemies.y[p] == pytest.approx(rig.enemies.y[h] + 10.0)
    rig.run(105)  # a full period later it is back at the hold point
    assert rig.enemies.x[rig.hull()] == pytest.approx(120.0, abs=1e-4)
    assert rig.enemies.y[rig.hull()] == pytest.approx(HOLD_Y, abs=1e-4)


# --- timeout (ENMY-09) ---


def test_the_fight_counts_steps_from_the_end_of_the_entrance() -> None:
    rig = Rig()
    rig.enter()
    assert rig.controller.fight_ticks == 0
    rig.run(10)
    assert rig.controller.fight_ticks == 10


def test_seconds_left_is_hidden_outside_the_fight_and_until_twenty_seconds_remain() -> None:
    rig = Rig(make_spec(timeout_ticks=1500))
    assert rig.controller.seconds_left == -1
    rig.enter()
    assert rig.controller.seconds_left == -1  # 25 s remain
    rig.controller.fight_ticks = 299
    assert rig.controller.seconds_left == -1  # 1201 steps: just over 20 s
    rig.controller.fight_ticks = 300
    assert rig.controller.seconds_left == 20
    rig.controller.fight_ticks = 359
    assert rig.controller.seconds_left == 20  # 1141 steps = 19.02 s rounds up
    rig.controller.fight_ticks = 360
    assert rig.controller.seconds_left == 19
    rig.controller.fight_ticks = 1499
    assert rig.controller.seconds_left == 1


def test_at_the_timeout_the_boss_retreats_shielded_and_silent_with_one_event() -> None:
    rig = Rig(make_spec(timeout_ticks=100))
    rig.enter()
    rig.run(99)
    assert rig.controller.state is BossState.FIGHT
    rig.step()
    assert rig.controller.state is BossState.RETREAT
    assert not rig.controller.destroyed
    (event,) = rig.events_of(EV_BOSS_RETREAT)
    assert event[2] == 1.0  # the boss slot
    for i in range(rig.enemies.n):
        assert rig.enemies.shield[i] == -1
    assert rig.controller.seconds_left == -1
    rig.bullets.clear()
    rig.run(200)
    assert rig.bullets.n == 0  # no firing while retreating
    assert rig.events_of(EV_BOSS_RETREAT) == []


def test_a_retreating_boss_rises_and_is_removed_above_the_exit_line() -> None:
    rig = Rig(make_spec(timeout_ticks=10))
    rig.enter()
    rig.run(10)
    y0 = float(rig.enemies.y[rig.hull()])
    rig.step()
    assert rig.enemies.y[rig.hull()] == pytest.approx(y0 - BOSS_RETREAT_SPEED)
    steps = 1
    while not rig.controller.gone:
        rig.step()
        steps += 1
        assert steps < 400
    assert rig.enemies.n == 0
    assert not rig.controller.active
    assert not rig.controller.destroyed
    assert rig.points == 0  # a retreat pays nothing
    assert rig.enemies.kills == 0


def test_the_retreat_waits_until_the_lowest_part_is_above_the_exit_line() -> None:
    low = (PartSpec(EnemyKind.TRAIN_TURRET, 0.0, 50.0, 30, 100, EnemyKind.TRAIN_STUMP),)
    rig = Rig(make_spec(parts=low, timeout_ticks=5, phases=(PhaseSpec(1.0, ()),)))
    rig.enter()
    rig.run(5)
    assert rig.controller.state is BossState.RETREAT
    y_before = float(rig.enemies.y[rig.hull()])
    while not rig.controller.gone:
        y_before = float(rig.enemies.y[rig.hull()])
        rig.step()
    # the part sits 50 below the hull: it is above -80 only once the hull is above -130
    assert y_before + 50.0 >= -80.0
    assert y_before - BOSS_RETREAT_SPEED + 50.0 < -80.0


def test_a_hull_destroyed_on_the_timeout_step_counts_as_destroyed() -> None:
    rig = Rig(make_spec(timeout_ticks=50))
    rig.enter()
    rig.run(49)
    hit_hull_to(rig, 0)
    paid = rig.step()  # fight_ticks reaches the timeout on this very step
    assert rig.controller.state is BossState.DYING
    assert rig.controller.destroyed
    assert paid == 20000
    assert rig.events_of(EV_BOSS_RETREAT) == []


def test_a_boss_that_nobody_shoots_still_ends() -> None:
    rig = Rig(make_spec(timeout_ticks=120))
    assert rig.start()
    steps = 0
    while not rig.controller.gone:
        rig.step()
        steps += 1
        assert steps < 1000
    assert not rig.controller.destroyed


# --- death sequence ---


def kill_hull(rig: Rig) -> int:
    hit_hull_to(rig, 0)
    return rig.step()


def test_a_destroyed_hull_pays_its_kill_points_once_and_starts_dying() -> None:
    rig = Rig()
    rig.enter()
    assert kill_hull(rig) == 20000
    assert rig.controller.state is BossState.DYING
    assert rig.controller.destroyed
    assert rig.controller.active
    assert rig.controller.hp_fraction == 0.0
    assert rig.step() == 0
    assert rig.points == 20000


def test_the_dying_hull_stays_as_a_shielded_row_and_stops_firing() -> None:
    rig = Rig()
    rig.enter()
    kill_hull(rig)
    h = rig.hull()  # remove_dead left it in the pool
    assert rig.enemies.hp[h] > 0
    for i in range(rig.enemies.n):
        assert rig.enemies.shield[i] == -1
    rig.bullets.clear()
    rig.run(rig.spec.death_ticks - 2)
    assert rig.bullets.n == 0
    rig.enemies.apply_hit(h, 999, rig.events)
    assert rig.enemies.hp[h] > 0


def test_a_part_hit_during_the_death_sequence_pays_nothing() -> None:
    rig = Rig()
    rig.enter()
    kill_hull(rig)
    p = rig.part(0)
    rig.enemies.apply_hit(p, 999, rig.events)
    assert rig.enemies.hp[p] == 30
    assert rig.step() == 0


def test_a_part_and_the_hull_dying_on_one_step_pay_both() -> None:
    rig = Rig()
    rig.enter()
    rig.kill_part(0)
    hit_hull_to(rig, 0)
    assert rig.step() == PART_POINTS + 20000
    assert rig.controller.state is BossState.DYING
    assert len(rig.events_of(EV_BOSS_PHASE)) == 0  # a dying boss changes no phase


def test_the_death_chain_pushes_low_priority_large_explosions_every_fifteen_steps() -> None:
    rig = Rig()
    rig.enter()
    kill_hull(rig)  # settle: the sequence starts, the first explosion is on the next step
    booms = []
    for _ in range(rig.spec.death_ticks - 1):
        rig.step()
        booms += rig.events_of(EV_EXPLOSION)
    assert len(booms) == 4  # steps 0, 15, 30 and 45 of a 60-step sequence
    assert {boom[2] for boom in booms} == {float(BLAST_LARGE)}
    assert len({(boom[0], boom[1]) for boom in booms}) == 4  # fixed, distinct offsets


def test_a_chain_explosion_is_refused_when_the_ring_is_nearly_full() -> None:
    rig = Rig()
    rig.enter()
    kill_hull(rig)
    rig.events.clear()
    for _ in range(EVENT_SOFT_CAP):
        rig.events.push(EV_EXPLOSION, 0.0, 0.0)
    dropped = rig.events.dropped
    rig.controller.step(rig.enemies, rig.bullets, SHIP_X, SHIP_Y, rig.events)
    assert rig.events.n == EVENT_SOFT_CAP
    assert rig.events.dropped == dropped + 1


def test_the_end_of_the_sequence_is_one_huge_explosion_and_a_defeat_event() -> None:
    rig = Rig(slot=2)
    rig.enter()
    kill_hull(rig)
    rig.bullets.spawn(10.0, 10.0, 0.0, 1.0)
    for _ in range(rig.spec.death_ticks):
        assert not rig.controller.gone
        rig.step()
    assert rig.controller.gone
    huge = [e for e in rig.events_of(EV_EXPLOSION) if e[2] == BLAST_HUGE]
    assert len(huge) == 1
    assert (huge[0][0], huge[0][1]) == (120.0, HOLD_Y)
    (defeat,) = rig.events_of(EV_BOSS_DEFEATED)
    assert defeat[2] == 2.0  # the boss slot
    assert rig.bullets.n == 0
    assert rig.hitstop.ticks == HITSTOP_BOSS_TICKS
    assert rig.enemies.n == 0
    assert rig.controller.destroyed
    assert not rig.controller.active
    assert rig.enemies.kills == 0  # removed with remove_uid, not killed: no double payment


def test_the_final_events_survive_a_nearly_full_ring() -> None:
    rig = Rig()
    rig.enter()
    kill_hull(rig)
    rig.run(rig.spec.death_ticks - 1)
    rig.events.clear()
    for _ in range(EVENT_SOFT_CAP):
        rig.events.push(EV_EXPLOSION, 0.0, 0.0)
    rig.controller.step(rig.enemies, rig.bullets, SHIP_X, SHIP_Y, rig.events)
    rig.controller.settle(rig.enemies, rig.bullets, rig.events, rig.hitstop)
    assert [e[2] for e in rig.events_of(EV_BOSS_DEFEATED)] == [1.0]
    assert rig.controller.gone


def test_a_gone_controller_ignores_further_steps_and_can_start_a_fresh_fight() -> None:
    rig = Rig(make_spec(timeout_ticks=5))
    rig.enter()
    rig.kill_part(0)
    rig.step()
    hit_hull_to(rig, 290)
    rig.run(400)
    assert rig.controller.gone
    assert rig.step() == 0
    assert rig.start()
    assert rig.controller.state is BossState.ENTER
    assert rig.controller.phase_number == 1
    assert rig.controller.fight_ticks == 0
    assert not rig.controller.destroyed
    assert rig.controller.hp_fraction == 1.0
    rig.enter()
    rig.kill_part(0)  # the part counts again after a restart
    assert rig.step() == PART_POINTS
