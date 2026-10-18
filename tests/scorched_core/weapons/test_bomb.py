import pytest

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import EV_BOMB_DETONATE, EV_HIT, EVENT_STRIDE
from scorched_core.tuning import (
    BOMB_BLAST_TICKS,
    BOMB_DAMAGE,
    BOMB_DAMAGE_INTERVAL,
    BOMB_GROW_TICKS,
    BOMB_LAUNCH_TICKS,
    BOMB_MIN_Y,
    BOMB_RADIUS_MAX,
    BOMB_RADIUS_MIN,
    BOMB_RISE,
    BOMB_START_STOCK,
)
from scorched_core.weapons.bomb import Bomb
from scorched_core.weapons.bomb_phase import BombPhase

SHIP_X = 120.0
SHIP_Y = 272.0
TARGET_Y = SHIP_Y - BOMB_RISE
JET_RADIUS = 9.0
HP = 1000


class _World:
    """The things a bomb touches, with one stationary jet at a chosen distance from the blast."""

    def __init__(self) -> None:
        self.enemies = EnemyPool()
        self.bullets = BulletPool(32)
        self.events = EventRing()

    def jet(self, x: float, y: float) -> int:
        self.enemies.spawn(EnemyKind.JET, x, y, MotionKind.DIVE, 0.0, 0.0)
        slot = self.enemies.n - 1
        self.enemies.hp[slot] = HP
        return slot

    def step(self, bomb: Bomb) -> bool:
        return bomb.step(self.enemies, self.bullets, self.events)


def _launched(stock: int = BOMB_START_STOCK) -> tuple[Bomb, _World]:
    bomb = Bomb(stock=stock)
    assert bomb.try_launch(SHIP_X, SHIP_Y)
    return bomb, _World()


def _detonated() -> tuple[Bomb, _World]:
    bomb, world = _launched()
    for _ in range(BOMB_LAUNCH_TICKS):
        detonated = world.step(bomb)
    assert detonated
    return bomb, world


def _event_kinds(events: EventRing) -> list[int]:
    return [int(events.buf[i * EVENT_STRIDE]) for i in range(events.n)]


def test_a_new_bomb_is_idle_with_the_starting_stock() -> None:
    bomb = Bomb(stock=BOMB_START_STOCK)
    assert (bomb.stock, bomb.phase, bomb.radius, bomb.progress) == (3, BombPhase.NONE, 0.0, 0.0)


def test_try_launch_spends_one_bomb_and_aims_110_units_ahead() -> None:
    bomb = Bomb(stock=3)
    assert bomb.try_launch(SHIP_X, SHIP_Y)
    assert (bomb.stock, bomb.phase) == (2, BombPhase.LAUNCH)
    assert (bomb.x, bomb.y, bomb.target_y) == (SHIP_X, SHIP_Y, 162.0)


def test_the_target_never_rises_above_y_90() -> None:
    bomb = Bomb(stock=3)
    assert bomb.try_launch(SHIP_X, 150.0)
    assert bomb.target_y == BOMB_MIN_Y
    for _ in range(BOMB_LAUNCH_TICKS):
        bomb.step(EnemyPool(), BulletPool(1), EventRing())
    assert bomb.y == BOMB_MIN_Y


@pytest.mark.parametrize("phase", [BombPhase.LAUNCH, BombPhase.BLAST])
def test_a_second_launch_while_a_bomb_is_active_is_refused(phase: BombPhase) -> None:
    bomb = Bomb(stock=3, phase=phase)
    assert not bomb.try_launch(SHIP_X, SHIP_Y)
    assert bomb.stock == 3
    assert bomb.phase == phase


def test_a_launch_with_no_stock_is_refused() -> None:
    bomb = Bomb(stock=0)
    assert not bomb.try_launch(SHIP_X, SHIP_Y)
    assert (bomb.stock, bomb.phase) == (0, BombPhase.NONE)


def test_an_idle_bomb_does_nothing_on_a_step() -> None:
    bomb, world = Bomb(stock=1), _World()
    world.bullets.spawn(5.0, 5.0, 0.0, 0.0)
    assert not world.step(bomb)
    assert world.bullets.n == 1
    assert world.events.n == 0


def test_the_missile_rises_in_a_straight_line_over_24_steps() -> None:
    bomb, world = _launched()
    for step in range(1, BOMB_LAUNCH_TICKS):
        assert not world.step(bomb)
        assert bomb.phase == BombPhase.LAUNCH
        assert bomb.x == SHIP_X
        assert bomb.y == pytest.approx(SHIP_Y - BOMB_RISE * step / BOMB_LAUNCH_TICKS)
        assert bomb.progress == pytest.approx(step / BOMB_LAUNCH_TICKS)
    assert world.events.n == 0


def test_the_24th_step_detonates_clears_the_bullets_and_pushes_the_event() -> None:
    bomb, world = _launched()
    for i in range(10):
        world.bullets.spawn(float(i), 5.0, 0.0, 0.0)
    for _ in range(BOMB_LAUNCH_TICKS - 1):
        world.step(bomb)
    assert world.bullets.n == 10
    assert world.step(bomb)
    assert bomb.phase == BombPhase.BLAST
    assert (bomb.x, bomb.y) == (SHIP_X, TARGET_Y)
    assert world.bullets.n == 0
    assert _event_kinds(world.events) == [EV_BOMB_DETONATE]
    assert (world.events.buf[1], world.events.buf[2]) == (SHIP_X, TARGET_Y)


def test_the_radius_grows_from_20_to_230_over_30_blast_steps() -> None:
    bomb, world = _detonated()
    radii = []
    for _ in range(BOMB_BLAST_TICKS):
        world.step(bomb)
        radii.append(bomb.radius if bomb.phase == BombPhase.BLAST else BOMB_RADIUS_MAX)
    assert radii[0] == BOMB_RADIUS_MIN
    assert radii[BOMB_GROW_TICKS - 1] == BOMB_RADIUS_MAX
    assert radii[BOMB_GROW_TICKS:] == [BOMB_RADIUS_MAX] * (BOMB_BLAST_TICKS - BOMB_GROW_TICKS)
    assert radii[:BOMB_GROW_TICKS] == sorted(radii[:BOMB_GROW_TICKS])
    assert radii[0] < radii[1] < radii[2]


def test_the_radius_is_at_its_minimum_before_the_first_blast_step() -> None:
    bomb, _ = _detonated()
    assert bomb.radius == BOMB_RADIUS_MIN
    assert bomb.progress == 0.0


def test_the_blast_lasts_90_steps_then_the_phase_is_none_again() -> None:
    bomb, world = _detonated()
    for step in range(1, BOMB_BLAST_TICKS):
        world.step(bomb)
        assert bomb.phase == BombPhase.BLAST
        assert bomb.progress == pytest.approx(step / BOMB_BLAST_TICKS)
    world.step(bomb)
    assert bomb.phase == BombPhase.NONE
    assert (bomb.radius, bomb.progress) == (0.0, 0.0)
    assert bomb.stock == BOMB_START_STOCK - 1


def test_a_finished_bomb_can_be_followed_by_the_next_one() -> None:
    bomb, world = _detonated()
    for _ in range(BOMB_BLAST_TICKS):
        world.step(bomb)
    assert bomb.try_launch(SHIP_X, SHIP_Y)
    assert bomb.stock == BOMB_START_STOCK - 2


def test_enemies_inside_the_blast_take_4_damage_on_blast_steps_1_7_13() -> None:
    bomb, world = _detonated()
    slot = world.jet(SHIP_X, TARGET_Y)
    expected = HP
    for step in range(1, 19):
        world.step(bomb)
        if (step - 1) % BOMB_DAMAGE_INTERVAL == 0:
            expected -= BOMB_DAMAGE
        assert world.enemies.hp[slot] == expected, step
    assert expected == HP - 3 * BOMB_DAMAGE


def test_a_hit_pushes_the_flash_event_and_the_blast_reaches_ground_units_too() -> None:
    bomb, world = _detonated()
    world.events.clear()
    world.enemies.spawn(EnemyKind.TANK, SHIP_X, TARGET_Y, MotionKind.GROUND, 0.0, 0.0)
    world.enemies.hp[0] = HP
    world.step(bomb)
    assert world.enemies.hp[0] == HP - BOMB_DAMAGE
    assert _event_kinds(world.events) == [EV_HIT]


def test_an_enemy_outside_the_current_radius_is_untouched_until_the_fireball_reaches_it() -> None:
    bomb, world = _detonated()
    far = world.jet(SHIP_X + 120.0, TARGET_Y)  # 120 units away: outside the first radius of 20
    world.step(bomb)
    assert world.enemies.hp[far] == HP
    for _ in range(BOMB_GROW_TICKS):
        world.step(bomb)
    assert world.enemies.hp[far] < HP  # the full 230 radius covers it


def test_bullets_that_enter_the_growing_fireball_are_cleared_the_same_step() -> None:
    bomb, world = _detonated()
    outside = world.bullets.spawn(SHIP_X + BOMB_RADIUS_MIN + 5.0, TARGET_Y, 0.0, 0.0)
    assert outside
    world.step(bomb)
    assert world.bullets.n == 1  # radius 20 does not reach 25
    while bomb.radius < BOMB_RADIUS_MIN + 5.0:
        assert world.bullets.n == 1
        world.step(bomb)
    assert world.bullets.n == 0


def test_a_bullet_exactly_on_the_current_radius_is_cleared() -> None:
    bomb, world = _detonated()
    world.bullets.spawn(SHIP_X + BOMB_RADIUS_MIN, TARGET_Y, 0.0, 0.0)
    world.step(bomb)
    assert world.bullets.n == 0


def test_a_bullet_just_outside_the_current_radius_survives() -> None:
    bomb, world = _detonated()
    world.bullets.spawn(SHIP_X + BOMB_RADIUS_MIN + 0.5, TARGET_Y, 0.0, 0.0)
    world.step(bomb)
    assert world.bullets.n == 1


def test_an_unknown_phase_is_loud() -> None:
    bomb = Bomb(stock=1, phase=99)  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="unknown bomb phase 99"):
        _World().step(bomb)
