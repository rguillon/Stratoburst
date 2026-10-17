from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.tuning import (
    FIRE_INTERVAL_TICKS,
    MUZZLE_AHEAD,
    PBULLET_SPEED,
    TWIN_OFFSET,
)
from scorched_core.weapons.twin_shot import TwinShot


def test_fire_interval_is_five_steps() -> None:
    assert FIRE_INTERVAL_TICKS == 5


def test_the_first_fire_step_spawns_a_volley_immediately() -> None:
    pool = BulletPool(128)
    assert TwinShot().step(True, 100.0, 200.0, pool) == 2
    assert pool.n == 2


def test_a_volley_is_two_bolts_five_units_either_side_and_ten_ahead() -> None:
    pool = BulletPool(128)
    TwinShot().step(True, 100.0, 200.0, pool)
    assert sorted((pool.x[0], pool.x[1])) == [100.0 - TWIN_OFFSET, 100.0 + TWIN_OFFSET]
    assert (pool.x[0], pool.x[1]) == (95.0, 105.0)
    assert (pool.y[0], pool.y[1]) == (200.0 - MUZZLE_AHEAD, 200.0 - MUZZLE_AHEAD)
    assert (pool.vx[0], pool.vx[1]) == (0.0, 0.0)
    assert (pool.vy[0], pool.vy[1]) == (-PBULLET_SPEED, -PBULLET_SPEED)


def test_holding_fire_for_sixty_steps_gives_twelve_volleys_of_two() -> None:
    pool = BulletPool(128)
    twin = TwinShot()
    spawned = [twin.step(True, 100.0, 200.0, pool) for _ in range(60)]
    assert sum(spawned) == 24
    assert [i for i, count in enumerate(spawned) if count] == list(range(0, 60, 5))


def test_not_firing_never_spawns() -> None:
    pool = BulletPool(128)
    twin = TwinShot()
    assert sum(twin.step(False, 100.0, 200.0, pool) for _ in range(20)) == 0
    assert pool.n == 0


def test_releasing_and_pressing_again_does_not_beat_the_fire_interval() -> None:
    pool = BulletPool(128)
    twin = TwinShot()
    assert twin.step(True, 100.0, 200.0, pool) == 2  # step 0
    assert twin.step(False, 100.0, 200.0, pool) == 0  # step 1
    assert twin.step(False, 100.0, 200.0, pool) == 0  # step 2
    assert twin.step(True, 100.0, 200.0, pool) == 0  # step 3: still cooling
    assert twin.step(True, 100.0, 200.0, pool) == 0  # step 4
    assert twin.step(True, 100.0, 200.0, pool) == 2  # step 5
    assert pool.n == 4


def test_the_cooldown_runs_down_while_fire_is_released() -> None:
    pool = BulletPool(128)
    twin = TwinShot()
    twin.step(True, 100.0, 200.0, pool)
    for _ in range(10):
        twin.step(False, 100.0, 200.0, pool)
    assert twin.cooldown == 0
    assert twin.step(True, 100.0, 200.0, pool) == 2


def test_a_full_pool_drops_the_volley_without_raising() -> None:
    pool = BulletPool(128)
    for _ in range(128):
        assert pool.spawn(0.0, 0.0, 0.0, 0.0)
    assert TwinShot().step(True, 100.0, 200.0, pool) == 0
    assert pool.n == 128


def test_one_free_slot_spawns_one_bolt_and_reports_it() -> None:
    pool = BulletPool(3)
    pool.spawn(0.0, 0.0, 0.0, 0.0)
    pool.spawn(0.0, 0.0, 0.0, 0.0)
    assert TwinShot().step(True, 100.0, 200.0, pool) == 1
    assert pool.n == 3


def test_a_dropped_volley_still_starts_the_cooldown() -> None:
    pool = BulletPool(2)
    pool.spawn(0.0, 0.0, 0.0, 0.0)
    pool.spawn(0.0, 0.0, 0.0, 0.0)
    twin = TwinShot()
    twin.step(True, 100.0, 200.0, pool)
    assert twin.cooldown == FIRE_INTERVAL_TICKS - 1
