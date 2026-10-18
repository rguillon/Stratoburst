import math
from array import array

import pytest

from scorched_core.bosses.boss_controller import BossController
from scorched_core.bosses.boss_spec import BossSpec
from scorched_core.bosses.boss_state import BossState
from scorched_core.bosses.part_spec import PartSpec
from scorched_core.clock.hitstop import Hitstop
from scorched_core.collision.circle_hits import resolve_shots_vs_enemies
from scorched_core.collision.uniform_grid import UniformGrid
from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import (
    BLAST_MEDIUM,
    ENEMY_CAP,
    EV_EXPLOSION,
    EV_PART_DESTROYED,
    EVENT_STRIDE,
    PLAYFIELD_H,
    PLAYFIELD_W,
)
from scorched_core.tuning import ENEMY_GROUND, ENEMY_MAX_ALIVE, GRID_CELL, HITSTOP_PART_TICKS

SHIP_X = 120.0
SHIP_Y = 272.0
HOLD_Y = 80.0
PART_POINTS = 1500
DX = 36.0  # clear of the hull circle (28 + 2 < 37.4), so a bolt at a part hits the part


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
    }
    return BossSpec(**{**fields, **overrides})  # type: ignore[arg-type]


class Rig:
    """A controller with the pools it drives, stepped in the game's order."""

    def __init__(self, spec: BossSpec | None = None, slot: int = 1) -> None:
        self.spec = spec or make_spec()
        self.controller = BossController(self.spec, slot)
        self.enemies = EnemyPool()
        self.bullets = BulletPool(400)
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
    assert gone == (x, y, PART_POINTS, 0.0, 1.0, 0.0)


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
