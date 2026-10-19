import math

from scorched_core.bosses.stage_1_bosses import BOMBER_1, MIDBOSS_1
from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.patterns.pattern_library import PATTERN_TABLE
from scorched_core.tuning import BOSS_MAX_RADIUS, MISSILE_RADIUS, PBULLET_RADIUS


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


# --- the giant bomber (plan 03-19) ---------------------------------------------------------------


def test_the_boss_is_a_giant_bomber_over_the_centre_column() -> None:
    assert BOMBER_1.hull_kind == EnemyKind.BOMBER
    assert (BOMBER_1.hull_hp, BOMBER_1.hull_radius, BOMBER_1.x) == (1400, 28.0, 120.0)
    assert BOMBER_1.enter_y < 0.0  # it descends into view from above the screen
    assert BOMBER_1.hold_y == 84.0
    assert BOMBER_1.enter_speed > 0.0


def test_the_bomber_has_two_wing_turrets_and_two_engines_that_leave_stumps() -> None:
    turrets, engines = BOMBER_1.parts[:2], BOMBER_1.parts[2:]
    assert [(p.kind, p.dx, p.dy) for p in turrets] == [
        (EnemyKind.BOMBER_TURRET, -46.0, 6.0),
        (EnemyKind.BOMBER_TURRET, 46.0, 6.0),
    ]
    assert [(p.kind, p.dx, p.dy) for p in engines] == [
        (EnemyKind.BOMBER_ENGINE, -26.0, -2.0),
        (EnemyKind.BOMBER_ENGINE, 26.0, -2.0),
    ]
    assert [(p.hp, p.points) for p in turrets] == [(200, 8000)] * 2
    assert [(p.hp, p.points) for p in engines] == [(220, 6000)] * 2
    assert all(p.stump_kind == EnemyKind.BOMBER_STUMP for p in BOMBER_1.parts)
    assert all(p.effective_radius <= BOSS_MAX_RADIUS for p in BOMBER_1.parts)


def test_the_bomber_times_out_at_a_hundred_seconds_and_a_kill_pays_nothing_directly() -> None:
    assert BOMBER_1.timeout_ticks == 100 * 60 == 6000
    assert BOMBER_1.kill_points == 0  # the stage tally pays the boss bonus (D-18)
    assert BOMBER_1.death_ticks == 150


def test_phase_one_fires_from_both_turrets_and_the_nose_while_the_bomber_sways() -> None:
    first = BOMBER_1.phases[0]
    assert first.hp_frac == 1.0
    assert [(e.pattern, e.part, e.dx, e.dy) for e in first.emitters] == [
        ("bomber_turret_spread", 0, 0.0, 0.0),
        ("bomber_turret_spread", 1, 0.0, 0.0),
        ("bomber_nose_ring", -1, 0.0, 24.0),
    ]
    assert (first.sway_x, first.sway_period) == (30.0, 360)
    assert first.hull_kind is None


def test_every_bomber_part_has_a_lip_a_bolt_can_reach_without_touching_the_hull() -> None:
    # Bolts and missiles stop at the first row they touch and the hull spawns first, so a part
    # whose circle sat wholly inside the hull's (grown by the shot) could never be shot by them.
    shot = max(PBULLET_RADIUS, MISSILE_RADIUS)
    for part in BOMBER_1.parts:
        reach = math.hypot(part.dx, part.dy) + part.effective_radius
        assert reach > BOMBER_1.hull_radius + shot
    turrets = BOMBER_1.parts[:2]
    for part in turrets:  # the wing turrets stand clear of the hull altogether
        gap = math.hypot(part.dx, part.dy) - part.effective_radius
        assert gap > BOMBER_1.hull_radius + shot


def test_the_bomber_has_three_phases_at_sixty_and_twenty_five_percent_of_the_hull() -> None:
    assert [phase.hp_frac for phase in BOMBER_1.phases] == [1.0, 0.6, 0.25]


def test_phase_two_opens_the_core_and_adds_a_rotating_ring_and_a_stream() -> None:
    second = BOMBER_1.phases[1]
    assert second.hull_kind == EnemyKind.BOMBER_OPEN
    assert [(e.pattern, e.part, e.dx, e.dy) for e in second.emitters] == [
        ("bomber_turret_spread", 0, 0.0, 0.0),  # the turrets keep firing while they live
        ("bomber_turret_spread", 1, 0.0, 0.0),
        ("bomber_core_ring", -1, 0.0, 0.0),
        ("bomber_core_stream", -1, 0.0, 0.0),
    ]
    assert second.sway_x == 36.0
    assert PATTERN_TABLE[second.emitters[2].pattern_id].phase_step_deg > 0.0  # it rotates


def test_phase_three_is_desperation_fire_from_the_core_with_a_wider_sway() -> None:
    third = BOMBER_1.phases[2]
    assert third.hull_kind is None  # the core stays open
    assert [(e.pattern, e.part, e.dx, e.dy) for e in third.emitters] == [
        ("bomber_desperation_ring", -1, 0.0, 0.0),
        ("bomber_desperation_spread", -1, 0.0, 0.0),
    ]
    assert (third.sway_x, third.sway_y) == (44.0, 8.0)


def test_total_bomber_hit_points_sit_in_the_research_range_for_a_long_fight() -> None:
    total = BOMBER_1.hull_hp + sum(part.hp for part in BOMBER_1.parts)
    assert 2000 <= total <= 2500


def test_no_bomber_gun_in_any_phase_is_faster_than_two_or_closer_than_forty_five_steps() -> None:
    for phase in BOMBER_1.phases:
        for emitter in phase.emitters:
            pattern = PATTERN_TABLE[emitter.pattern_id]
            assert pattern.speed <= 2.0
            assert pattern.interval >= 45
