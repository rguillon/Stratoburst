from scorched_core.bosses.stage_1_bosses import MIDBOSS_1

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.tuning import BOSS_MAX_RADIUS


def test_the_midboss_is_an_armored_train_on_the_maglev_column() -> None:
    assert MIDBOSS_1.hull_kind == EnemyKind.TRAIN
    assert MIDBOSS_1.hull_hp == 500
    assert MIDBOSS_1.hull_radius == 28.0
    assert MIDBOSS_1.x == 120.0  # the maglev line runs down the centre column


def test_the_train_rides_in_from_above_the_screen_and_holds_in_the_upper_half() -> None:
    assert MIDBOSS_1.enter_y < 0.0
    assert MIDBOSS_1.hold_y == 96.0
    assert MIDBOSS_1.enter_speed > 0.0


def test_the_midboss_has_two_destructible_turrets_that_leave_stumps() -> None:
    assert [(p.kind, p.dx, p.dy) for p in MIDBOSS_1.parts] == [
        (EnemyKind.TRAIN_TURRET, 0.0, -22.0),
        (EnemyKind.TRAIN_TURRET, 0.0, 22.0),
    ]
    for part in MIDBOSS_1.parts:
        assert (part.hp, part.points, part.stump_kind) == (120, 5000, EnemyKind.TRAIN_STUMP)
        assert part.effective_radius <= BOSS_MAX_RADIUS


def test_the_midboss_times_out_after_forty_five_seconds_and_pays_twenty_thousand() -> None:
    assert MIDBOSS_1.timeout_ticks == 45 * 60 == 2700
    assert MIDBOSS_1.kill_points == 20000


def test_phase_one_aims_both_turrets_and_phase_two_opens_the_hull_spread_at_half_health() -> None:
    first, second = MIDBOSS_1.phases
    assert first.hp_frac == 1.0
    assert [(e.pattern, e.part) for e in first.emitters] == [
        ("train_turret_aimed", 0),
        ("train_turret_aimed", 1),
    ]
    assert first.sway_y > 0.0  # the train sways along its rail
    assert first.sway_x == 0.0
    assert second.hp_frac == 0.5
    assert [(e.pattern, e.part) for e in second.emitters] == [("train_hull_spread", -1)]
