import math

import pytest

from scorched_core.paths.path_library import (
    PATH_NAMES,
    PATH_TABLE,
    PATHS,
    arc_points,
    loop_points,
    path_index,
    s_curve_points,
)
from scorched_core.paths.path_spec import PathSpec

REQUIRED = (
    "swoop",
    "s_dive",
    "loop_back",
    "strafe",
    "hover_arc",
    "road_down",
    "road_bend",
)


def test_arc_points_has_steps_plus_one_points_starting_at_the_origin() -> None:
    points = arc_points(40.0, 0.0, 90.0, 6)
    assert len(points) == 7
    assert points[0] == (0.0, 0.0)


def test_a_quarter_arc_from_heading_down_ends_a_radius_across_and_a_radius_down() -> None:
    points = arc_points(40.0, 0.0, 90.0, 8)
    assert points[-1] == pytest.approx((40.0, 40.0))


def test_a_negative_sweep_turns_the_other_way() -> None:
    points = arc_points(40.0, 0.0, -90.0, 8)
    assert points[-1] == pytest.approx((-40.0, 40.0))


def test_every_arc_point_sits_on_one_circle() -> None:
    points = arc_points(30.0, 0.0, 180.0, 12)
    centre = (30.0, 0.0)  # heading down, turning toward +x: the centre is a radius to the right
    assert all(math.dist(point, centre) == pytest.approx(30.0) for point in points)


def test_the_arc_starts_heading_along_the_start_angle() -> None:
    points = arc_points(50.0, 90.0, 45.0, 40)  # heading right
    first_dx, first_dy = points[1][0] - points[0][0], points[1][1] - points[0][1]
    assert first_dx > 0.0
    assert abs(first_dy) < first_dx * 0.1


def test_a_full_loop_closes_on_its_start() -> None:
    points = loop_points(20.0, 12)
    assert len(points) == 13
    assert points[0] == (0.0, 0.0)
    assert points[-1] == pytest.approx((0.0, 0.0), abs=1e-9)


def test_an_s_curve_starts_at_the_origin_and_runs_down_the_length() -> None:
    points = s_curve_points(30.0, 200.0, 12)
    assert len(points) == 13
    assert points[0] == (0.0, 0.0)
    assert points[-1] == pytest.approx((0.0, 200.0), abs=1e-9)
    assert max(x for x, _ in points) == pytest.approx(30.0)
    assert min(x for x, _ in points) == pytest.approx(-30.0)


@pytest.mark.parametrize(
    "call",
    [
        lambda: arc_points(0.0, 0.0, 90.0, 4),
        lambda: arc_points(-5.0, 0.0, 90.0, 4),
        lambda: arc_points(10.0, 0.0, 90.0, 0),
        lambda: arc_points(10.0, 0.0, 0.0, 4),
        lambda: loop_points(0.0, 8),
        lambda: loop_points(10.0, 2),
        lambda: s_curve_points(10.0, 0.0, 6),
        lambda: s_curve_points(10.0, 100.0, 1),
    ],
)
def test_a_degenerate_generator_call_is_rejected(call) -> None:
    with pytest.raises(ValueError, match=r"positive|at least|non-zero"):
        call()


def test_the_registry_has_every_required_path() -> None:
    assert set(REQUIRED) <= set(PATHS)


def test_every_registered_value_is_a_path_spec_that_starts_at_the_origin() -> None:
    assert all(isinstance(spec, PathSpec) for spec in PATHS.values())
    assert all(spec.points[0] == (0.0, 0.0) for spec in PATHS.values())


def test_the_table_and_names_follow_the_registry_order() -> None:
    assert tuple(PATHS) == PATH_NAMES
    assert tuple(PATHS.values()) == PATH_TABLE


def test_path_index_resolves_every_name_to_its_table_slot() -> None:
    for name in PATH_NAMES:
        assert PATH_TABLE[path_index(name)] is PATHS[name]


def test_an_unknown_path_name_raises_value_error() -> None:
    with pytest.raises(ValueError, match="unknown path 'nowhere'"):
        path_index("nowhere")


def test_the_road_paths_are_tank_speeds_relative_to_the_terrain() -> None:
    assert PATHS["road_down"].speed <= 0.5  # a crawl on top of the scroll
    assert PATHS["road_bend"].speed <= 1.0  # quick enough to turn on screen, still slower than jets


def test_the_swoop_leaves_toward_the_right_and_the_strafe_crosses_the_field() -> None:
    swoop, strafe = PATHS["swoop"], PATHS["strafe"]
    assert swoop.points[-1][0] > 150.0
    assert strafe.points[-1][0] > 200.0


def test_the_bend_turns_from_heading_down_to_heading_right() -> None:
    spec = PATHS["road_bend"]
    assert spec.seg_dy[0] == pytest.approx(1.0)
    assert spec.seg_dx[-1] == pytest.approx(1.0)
    assert spec.seg_dy[-1] == pytest.approx(0.0)
