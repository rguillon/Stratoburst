from array import array

from scorched_core.collision.uniform_grid import UniformGrid


def grid_with(points: list[tuple[float, float]], capacity: int = 32) -> UniformGrid:
    grid = UniformGrid(240.0, 320.0, 32.0, capacity)
    xs = array("f", [p[0] for p in points])
    ys = array("f", [p[1] for p in points])
    grid.rebuild(xs, ys, len(points))
    return grid


def query(grid: UniformGrid, x: float, y: float) -> list[int]:
    out = array("i", bytes(4 * grid.capacity))
    count = grid.query(x, y, out)
    return list(out[:count])


def test_grid_has_one_margin_cell_on_every_side() -> None:
    grid = UniformGrid(240.0, 320.0, 32.0, 32)
    assert (grid.cols, grid.rows) == (10, 12)  # ceil(7.5) + 2 and ceil(10) + 2


def test_cell_index_is_offset_by_the_margin_cell() -> None:
    grid = UniformGrid(240.0, 320.0, 32.0, 32)
    assert grid.cell_index(0.0, 0.0) == 1 * 10 + 1
    assert grid.cell_index(33.0, 65.0) == 3 * 10 + 2
    assert grid.cell_index(239.9, 319.9) == 10 * 10 + 8


def test_positions_outside_the_field_clamp_to_the_edge_cells() -> None:
    grid = UniformGrid(240.0, 320.0, 32.0, 32)
    assert grid.cell_index(-5.0, -5.0) == 0
    assert grid.cell_index(-1000.0, -1000.0) == 0
    assert grid.cell_index(1000.0, 1000.0) == grid.cols * grid.rows - 1
    assert grid.cell_index(-1000.0, 1000.0) == (grid.rows - 1) * grid.cols
    assert grid.cell_index(1000.0, -1000.0) == grid.cols - 1


def test_query_returns_exactly_the_three_by_three_block() -> None:
    points = [
        (100.0, 100.0),  # 0: centre cell
        (100.0 + 32.0, 100.0 + 32.0),  # 1: diagonal neighbour
        (100.0 + 96.0, 100.0),  # 2: three cells away
        (100.0, 100.0 - 64.0),  # 3: two rows up
        (100.0 - 31.0, 100.0),  # 4: left neighbour
    ]
    assert sorted(query(grid_with(points), 100.0, 100.0)) == [0, 1, 4]


def test_query_order_is_row_major_cells_then_ascending_index() -> None:
    points = [
        (100.0, 130.0),  # 0: row below, centre column
        (100.0, 100.0),  # 1: centre cell
        (68.0, 70.0),  # 2: row above, left column
        (100.0, 100.0),  # 3: centre cell (after 1)
        (130.0, 100.0),  # 4: right neighbour
        (100.0, 70.0),  # 5: row above, centre column
        (68.0, 100.0),  # 6: left neighbour
    ]
    # Rows from the top: [2, 5], then [6, 1, 3, 4] (left, centre ascending, right), then [0].
    assert query(grid_with(points), 100.0, 100.0) == [2, 5, 6, 1, 3, 4, 0]


def test_items_in_one_cell_come_back_in_ascending_index_order() -> None:
    points = [(100.0, 100.0)] * 6
    assert query(grid_with(points), 100.0, 100.0) == [0, 1, 2, 3, 4, 5]


def test_a_query_at_the_field_corner_still_sees_margin_cell_items() -> None:
    points = [(-5.0, -5.0), (20.0, 20.0), (200.0, 200.0)]
    assert query(grid_with(points), 0.0, 0.0) == [0, 1]


def test_a_query_at_the_far_corner_clips_the_block_to_the_grid() -> None:
    points = [(239.0, 319.0), (300.0, 400.0), (10.0, 10.0)]
    assert query(grid_with(points), 239.0, 319.0) == [0, 1]


def test_rebuild_forgets_the_previous_contents() -> None:
    grid = grid_with([(100.0, 100.0), (100.0, 100.0)])
    xs = array("f", [100.0])
    ys = array("f", [100.0])
    grid.rebuild(xs, ys, 1)
    assert query(grid, 100.0, 100.0) == [0]
    grid.rebuild(xs, ys, 0)
    assert query(grid, 100.0, 100.0) == []


def test_the_count_never_exceeds_capacity() -> None:
    grid = grid_with([(100.0, 100.0)] * 10, capacity=4)
    assert query(grid, 100.0, 100.0) == [0, 1, 2, 3]


def test_an_empty_grid_returns_nothing() -> None:
    assert query(grid_with([]), 10.0, 10.0) == []


def test_query_writes_into_the_callers_buffer_only() -> None:
    grid = grid_with([(100.0, 100.0)])
    out = array("i", [-1, -1, -1])
    assert grid.query(100.0, 100.0, out) == 1
    assert list(out) == [0, -1, -1]
