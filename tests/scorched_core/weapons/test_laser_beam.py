import pytest

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.tuning import (
    LASER_DAMAGE,
    LASER_HALF_WIDTH,
    LASER_HIT_INTERVAL,
    MAX_LEVEL,
    MUZZLE_AHEAD,
)
from scorched_core.weapons.laser_beam import LaserBeam

SHIP_X = 100.0
SHIP_Y = 250.0


def _target(hp: int = 1000) -> EnemyPool:
    enemies = EnemyPool()
    enemies.spawn(EnemyKind.JET, SHIP_X, 120.0, MotionKind.DIVE, 0.0, 0.0)
    enemies.hp[0] = hp
    return enemies


def _step(
    beam: LaserBeam,
    enemies: EnemyPool,
    *,
    firing: bool = True,
    level: int = 1,
    events: EventRing | None = None,
) -> int:
    return beam.step(firing, SHIP_X, SHIP_Y, level, enemies, events or EventRing())


def test_the_level_tables_cover_every_level() -> None:
    assert len(LASER_HALF_WIDTH) == len(LASER_DAMAGE) == MAX_LEVEL
    assert LASER_HALF_WIDTH == (2.0, 3.0, 4.0, 5.5, 7.0)
    assert LASER_DAMAGE == (1, 2, 3, 4, 5)
    assert LASER_HIT_INTERVAL == 3


def test_a_new_beam_is_off() -> None:
    assert (LaserBeam().half_width, LaserBeam().timer) == (0.0, 0)


@pytest.mark.parametrize("level", range(1, MAX_LEVEL + 1))
def test_firing_sets_the_half_width_of_the_level(level: int) -> None:
    beam = LaserBeam()
    _step(beam, EnemyPool(), level=level)
    assert beam.half_width == LASER_HALF_WIDTH[level - 1]


@pytest.mark.parametrize("level", range(1, MAX_LEVEL + 1))
def test_the_first_firing_step_deals_the_damage_of_the_level(level: int) -> None:
    enemies = _target(hp=100)
    assert _step(LaserBeam(), enemies, level=level) == 1
    assert enemies.hp[0] == 100 - LASER_DAMAGE[level - 1]


def test_damage_cadence_is_the_first_step_then_every_third_step_while_fire_is_held() -> None:
    beam, enemies = LaserBeam(), _target(hp=100)
    hits = [_step(beam, enemies) for _ in range(10)]
    assert hits == [1, 0, 0, 1, 0, 0, 1, 0, 0, 1]


def test_releasing_fire_switches_the_beam_off_at_once_and_resets_the_cadence() -> None:
    beam, enemies = LaserBeam(), _target(hp=100)
    _step(beam, enemies, level=3)
    assert beam.half_width == LASER_HALF_WIDTH[2]
    assert _step(beam, enemies, firing=False, level=3) == 0
    assert (beam.half_width, beam.timer) == (0.0, 0)
    assert _step(beam, enemies, level=3) == 1  # pressing again hits on the first firing step


def test_a_beam_that_is_off_deals_no_damage() -> None:
    enemies = _target(hp=100)
    assert _step(LaserBeam(), enemies, firing=False) == 0
    assert enemies.hp[0] == 100


def test_the_beam_reaches_from_the_nose_not_from_the_ship_centre() -> None:
    enemies = EnemyPool()
    nose = SHIP_Y - MUZZLE_AHEAD
    enemies.spawn(EnemyKind.JET, SHIP_X, nose + 9.5, MotionKind.DIVE, 0.0, 0.0)  # just below reach
    assert _step(LaserBeam(), enemies) == 0
    enemies.y[0] = nose + 9.0
    assert _step(LaserBeam(), enemies) == 1


def test_a_laser_hit_pushes_one_merged_hit_event() -> None:
    beam, enemies, events = LaserBeam(), _target(hp=100), EventRing()
    _step(beam, enemies, events=events)
    assert events.n == 1
