import pytest
from scorched_core.stages.ground_entry import GroundEntry

from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.pickup_kind import PickupKind
from scorched_core.protocol import CITY_STRIDE
from scorched_core.stages.city_block import CityBlock
from scorched_core.stages.city_builder import scenery_placements, target_entries
from scorched_core.stages.city_feature import CityFeature
from scorched_core.stages.city_style import CityStyle
from scorched_core.stages.scenery_kind import SceneryKind
from scorched_core.tuning import CITY_BLOCK, CITY_MAX_HEIGHT, CITY_PITCH

Record = tuple[float, ...]


def records(flat: tuple[float, ...]) -> list[Record]:
    return [flat[i : i + CITY_STRIDE] for i in range(0, len(flat), CITY_STRIDE)]


def of_kind(flat: tuple[float, ...], *kinds: SceneryKind) -> list[Record]:
    return [rec for rec in records(flat) if int(rec[0]) in {int(kind) for kind in kinds}]


def block(**changes: object) -> CityBlock:
    fields: dict[str, object] = {
        "d": 160.0,
        "col": 1,
        "cols": 3,
        "rows": 3,
        "style": CityStyle.SLUMS,
        "seed": 7,
    }
    return CityBlock(**{**fields, **changes})  # type: ignore[arg-type]


def own(flat: tuple[float, ...], target: CityBlock) -> list[Record]:
    """The records that belong to ``target``'s footprint."""
    x0 = CITY_PITCH * target.col + (CITY_PITCH - CITY_BLOCK) / 2
    d0 = target.d + (CITY_PITCH - CITY_BLOCK) / 2
    return [
        rec
        for rec in records(flat)
        if x0 <= rec[1] <= x0 + CITY_BLOCK and d0 <= rec[2] <= d0 + CITY_BLOCK
    ]


def test_the_result_is_a_flat_tuple_of_whole_records() -> None:
    flat = scenery_placements((block(),), (), 1)
    assert isinstance(flat, tuple)
    assert len(flat) > 0
    assert len(flat) % CITY_STRIDE == 0


def test_no_blocks_and_no_features_give_nothing() -> None:
    assert scenery_placements((), (), 1) == ()


def test_the_records_are_sorted_by_distance() -> None:
    blocks = (block(d=400.0), block(d=0.0, col=0), block(d=160.0, style=CityStyle.DOWNTOWN))
    features = (CityFeature(SceneryKind.MAGLEV, 120.0, 20.0, 380.0, 60.0),)
    distances = [rec[2] for rec in records(scenery_placements(blocks, features, 3))]
    assert distances == sorted(distances)


def test_the_same_seed_gives_the_same_layout_and_another_seed_a_different_one() -> None:
    blocks = (block(style=CityStyle.DOWNTOWN, signs=2, fires=1),)
    first = scenery_placements(blocks, (), 5)
    assert scenery_placements(blocks, (), 5) == first
    assert scenery_placements(blocks, (), 6) != first


def test_a_blocks_own_seed_changes_its_lots() -> None:
    assert scenery_placements((block(seed=1),), (), 5) != scenery_placements(
        (block(seed=2),), (), 5
    )


@pytest.mark.parametrize("style", list(CityStyle))
@pytest.mark.parametrize("col", [0, 1, 2])
def test_every_lot_lies_inside_its_block_footprint_never_on_a_road(
    style: CityStyle, col: int
) -> None:
    target = block(col=col, style=style, cols=4, rows=4, signs=3, fires=3)
    inner = [
        rec
        for rec in records(scenery_placements((target,), (), 9))
        if int(rec[0]) not in {SceneryKind.FIRE, SceneryKind.LAMP}
    ]
    x0 = CITY_PITCH * col + (CITY_PITCH - CITY_BLOCK) / 2
    d0 = target.d + (CITY_PITCH - CITY_BLOCK) / 2
    assert inner
    # Margin blocks sit far to the sides; only this block's own columns are checked here.
    for rec in own(scenery_placements((target,), (), 9), target):
        half = rec[3] / 2
        assert x0 - 1e-6 <= rec[1] - half
        assert rec[1] + half <= x0 + CITY_BLOCK + 1e-6
        assert d0 - 1e-6 <= rec[2] - half
        assert rec[2] + half <= d0 + CITY_BLOCK + 1e-6


def test_slums_are_low_houses_with_the_odd_lamp() -> None:
    flat = scenery_placements((block(cols=4, rows=4),), (), 2)
    houses = of_kind(flat, SceneryKind.SLUM_HOUSE)
    assert houses
    assert all(4.0 <= rec[4] <= 10.0 for rec in houses)
    assert of_kind(flat, SceneryKind.LAMP)
    assert not of_kind(flat, SceneryKind.TOWER, SceneryKind.HANGAR, SceneryKind.LOWRISE)


def test_downtown_mixes_towers_and_lowrises() -> None:
    flat = scenery_placements((block(style=CityStyle.DOWNTOWN, cols=4, rows=4),), (), 2)
    towers = of_kind(flat, SceneryKind.TOWER)
    lowrises = of_kind(flat, SceneryKind.LOWRISE)
    assert towers
    assert lowrises
    assert all(12.0 <= rec[4] <= 34.0 for rec in towers)


def test_the_airbase_is_hangars() -> None:
    flat = scenery_placements((block(style=CityStyle.AIRBASE, cols=2, rows=2),), (), 2)
    hangars = of_kind(flat, SceneryKind.HANGAR)
    assert hangars
    assert all(8.0 <= rec[4] <= 12.0 for rec in hangars)
    assert not of_kind(flat, SceneryKind.TOWER, SceneryKind.SLUM_HOUSE)


def test_each_fire_replaces_a_building_lot() -> None:
    plain = scenery_placements((block(cols=3, rows=3),), (), 4)
    burning = scenery_placements((block(cols=3, rows=3, fires=4),), (), 4)
    assert len(of_kind(burning, SceneryKind.FIRE)) == 4
    assert len(of_kind(plain, SceneryKind.FIRE)) == 0
    buildings = (SceneryKind.SLUM_HOUSE,)
    assert len(of_kind(plain, *buildings)) - len(of_kind(burning, *buildings)) == 4


def test_signs_stand_beside_towers_and_carry_a_neon_hue_variant() -> None:
    flat = scenery_placements((block(style=CityStyle.DOWNTOWN, cols=3, rows=3, signs=4),), (), 2)
    signs = of_kind(flat, SceneryKind.SIGN)
    assert len(signs) == 4
    assert all(float(rec[5]).is_integer() and 0 <= rec[5] < 6 for rec in signs)
    towers = of_kind(flat, SceneryKind.TOWER)
    assert towers
    assert any(abs(sign[2] - tower[2]) < 1e-9 for sign in signs for tower in towers)


def test_signs_fall_back_to_other_lots_when_there_are_no_towers() -> None:
    flat = scenery_placements((block(style=CityStyle.SLUMS, cols=2, rows=2, signs=3),), (), 2)
    assert len(of_kind(flat, SceneryKind.SIGN)) == 3


def test_more_signs_than_lots_stop_at_the_lots() -> None:
    flat = scenery_placements((block(style=CityStyle.SLUMS, cols=1, rows=1, signs=3),), (), 2)
    assert len(of_kind(flat, SceneryKind.SIGN)) == 1


def test_a_feature_emits_a_placement_every_spacing_along_its_x() -> None:
    feature = CityFeature(SceneryKind.MAGLEV, 120.0, 100.0, 300.0, 50.0)
    maglev = of_kind(scenery_placements((), (feature,), 1), SceneryKind.MAGLEV)
    assert [rec[2] for rec in maglev] == [100.0, 150.0, 200.0, 250.0, 300.0]
    assert {rec[1] for rec in maglev} == {120.0}


def test_runway_lights_are_small_and_alternate_their_variant() -> None:
    feature = CityFeature(SceneryKind.RUNWAY_LIGHT, 108.0, 0.0, 90.0, 30.0)
    lights = of_kind(scenery_placements((), (feature,), 1), SceneryKind.RUNWAY_LIGHT)
    assert [rec[5] for rec in lights] == [0.0, 1.0, 0.0, 1.0]
    assert all(rec[4] < 2.0 for rec in lights)


def test_a_feature_of_any_other_kind_is_rejected() -> None:
    feature = CityFeature(SceneryKind.TOWER, 120.0, 0.0, 90.0, 30.0)
    with pytest.raises(ValueError, match="TOWER"):
        scenery_placements((), (feature,), 1)


def test_lots_inside_a_feature_corridor_are_skipped() -> None:
    target = block(cols=3, rows=3, col=1, d=160.0)
    corridor = CityFeature(SceneryKind.MAGLEV, 120.0, 100.0, 400.0, 100.0)
    free = own(scenery_placements((target,), (), 3), target)
    crossed = own(scenery_placements((target,), (corridor,), 3), target)
    lots_free = [rec for rec in free if int(rec[0]) == SceneryKind.SLUM_HOUSE]
    lots_crossed = [rec for rec in crossed if int(rec[0]) == SceneryKind.SLUM_HOUSE]
    assert len(lots_crossed) < len(lots_free)
    assert all(abs(rec[1] - 120.0) > 6.0 for rec in lots_crossed)


def test_a_feature_leaves_lots_outside_its_distance_range_alone() -> None:
    target = block(cols=3, rows=3, col=1, d=160.0)
    far = CityFeature(SceneryKind.MAGLEV, 120.0, 1000.0, 1200.0, 100.0)
    crossed = scenery_placements((target,), (far,), 3)
    lots = [rec for rec in records(crossed) if int(rec[0]) != SceneryKind.MAGLEV]
    assert lots == records(scenery_placements((target,), (), 3))


def test_margin_blocks_fill_columns_minus_two_minus_one_three_and_four() -> None:
    flat = scenery_placements((block(col=1, cols=1, rows=1, d=0.0),), (), 1)
    xs = sorted(rec[1] for rec in records(flat) if rec[1] < 0.0 or rec[1] > 240.0)
    centres = [CITY_PITCH * col + CITY_PITCH / 2 for col in (-2, -1, 3, 4)]
    assert len(xs) == 4
    assert xs == pytest.approx(centres)
    for rec in records(flat):
        assert rec[3] > 40.0 or 0.0 <= rec[1] <= 240.0  # margin buildings are large


def test_margin_blocks_are_added_for_every_authored_row_in_the_rows_style() -> None:
    blocks = (
        block(col=0, d=0.0, style=CityStyle.SLUMS, cols=1, rows=1),
        block(col=1, d=0.0, style=CityStyle.SLUMS, cols=1, rows=1),
        block(col=0, d=80.0, style=CityStyle.AIRBASE, cols=1, rows=1),
    )
    flat = scenery_placements(blocks, (), 1)
    margins = [rec for rec in records(flat) if rec[1] < 0.0 or rec[1] > 240.0]
    assert len(margins) == 8
    assert {int(rec[0]) for rec in margins if rec[2] < 80.0} == {int(SceneryKind.SLUM_HOUSE)}
    assert {int(rec[0]) for rec in margins if rec[2] > 80.0} == {int(SceneryKind.HANGAR)}


def test_every_height_stays_under_the_cap_for_every_style() -> None:
    blocks = tuple(
        block(d=80.0 * row, col=col, style=style, cols=4, rows=4, fires=2, signs=4)
        for row, style in enumerate(CityStyle)
        for col in (0, 1, 2)
    )
    features = (
        CityFeature(SceneryKind.MAGLEV, 120.0, 0.0, 240.0, 40.0),
        CityFeature(SceneryKind.RUNWAY_LIGHT, 108.0, 0.0, 240.0, 40.0),
    )
    assert all(
        rec[4] <= CITY_MAX_HEIGHT for rec in records(scenery_placements(blocks, features, 8))
    )


def test_a_margin_building_in_a_feature_corridor_is_skipped_too() -> None:
    target = block(col=1, cols=1, rows=1, d=0.0)
    corridor = CityFeature(SceneryKind.MAGLEV, -120.0, 0.0, 80.0, 80.0)
    flat = scenery_placements((target,), (corridor,), 1)
    buildings = [rec for rec in records(flat) if int(rec[0]) != SceneryKind.MAGLEV]
    assert -120.0 not in {rec[1] for rec in buildings}
    assert len([rec for rec in buildings if rec[1] < 0.0 or rec[1] > 240.0]) == 3


# --- destructible targets (plan 03-15) ---------------------------------------------------------


def lot_centre(target: CityBlock, lot: int) -> tuple[float, float]:
    """The (x, distance) centre of lot ``lot`` of ``target``, computed independently."""
    cell = CITY_BLOCK / target.cols, CITY_BLOCK / target.rows
    row, col = divmod(lot, target.cols)
    inset = (CITY_PITCH - CITY_BLOCK) / 2
    return (
        CITY_PITCH * target.col + inset + (col + 0.5) * cell[0],
        target.d + inset + (row + 0.5) * cell[1],
    )


def test_no_targets_give_no_entries() -> None:
    assert target_entries(()) == ()
    assert target_entries((block(),)) == ()


def test_a_flagged_lot_becomes_one_ground_entry_at_the_lot_centre() -> None:
    target = block(cols=3, rows=2, targets=((4, EnemyKind.FUEL_TANK, PickupKind.MEDAL),))
    x, at = lot_centre(target, 4)
    assert target_entries((target,)) == (GroundEntry(at, EnemyKind.FUEL_TANK, x, PickupKind.MEDAL),)


def test_every_flagged_lot_gets_an_entry_sorted_by_distance_then_x() -> None:
    late = block(d=400.0, cols=1, rows=1, targets=((0, EnemyKind.DEPOT, None),))
    early = block(
        d=80.0,
        cols=2,
        rows=1,
        targets=((1, EnemyKind.HOUSE, None), (0, EnemyKind.BILLBOARD, PickupKind.MEDAL)),
    )
    entries = target_entries((late, early))
    assert [(entry.kind, entry.x) for entry in entries] == [
        (EnemyKind.BILLBOARD, lot_centre(early, 0)[0]),
        (EnemyKind.HOUSE, lot_centre(early, 1)[0]),
        (EnemyKind.DEPOT, lot_centre(late, 0)[0]),
    ]
    assert [entry.at for entry in entries] == sorted(entry.at for entry in entries)


def test_a_target_lot_is_left_out_of_the_scenery() -> None:
    plain = block(cols=2, rows=2)
    flagged = block(cols=2, rows=2, targets=((2, EnemyKind.HOUSE, None),))
    x, at = lot_centre(flagged, 2)

    def standing(flat: tuple[float, ...]) -> list[Record]:
        return [
            rec for rec in own(flat, flagged) if abs(rec[1] - x) < 1e-6 and abs(rec[2] - at) < 1e-6
        ]

    assert standing(scenery_placements((plain,), (), 6))
    assert not standing(scenery_placements((flagged,), (), 6))


def test_flagging_a_lot_removes_exactly_that_lot_from_a_block_without_fires_or_signs() -> None:
    flagged = block(cols=3, rows=3, targets=((0, EnemyKind.HOUSE, None),))
    plain = scenery_placements((block(cols=3, rows=3),), (), 6)
    fewer = scenery_placements((flagged,), (), 6)
    assert (
        len(of_kind(plain, SceneryKind.SLUM_HOUSE)) - len(of_kind(fewer, SceneryKind.SLUM_HOUSE))
        == 1
    )


def fires_of(flat: tuple[float, ...], target: CityBlock) -> list[Record]:
    return [rec for rec in own(flat, target) if int(rec[0]) == SceneryKind.FIRE]


def test_a_fire_never_lands_on_a_target_lot() -> None:
    every_lot_but_one = tuple((lot, EnemyKind.HOUSE, None) for lot in range(1, 4))
    target = block(cols=2, rows=2, fires=1, targets=every_lot_but_one)
    fires = fires_of(scenery_placements((target,), (), 6), target)
    assert len(fires) == 1
    assert (fires[0][1], fires[0][2]) == pytest.approx(lot_centre(target, 0))


def test_more_fires_than_free_lots_burn_every_free_lot() -> None:
    target = block(cols=2, rows=1, fires=2, targets=((1, EnemyKind.HOUSE, None),))
    assert len(fires_of(scenery_placements((target,), (), 6), target)) == 1


def test_a_sign_is_never_hung_on_a_target_lot() -> None:
    target = block(
        style=CityStyle.DOWNTOWN, cols=2, rows=1, signs=2, targets=((0, EnemyKind.BILLBOARD, None),)
    )
    target_x, free_x = lot_centre(target, 0)[0], lot_centre(target, 1)[0]
    signs = of_kind(scenery_placements((target,), (), 6), SceneryKind.SIGN)
    assert len(signs) == 1  # two were asked for but only the free lot can carry one
    assert abs(signs[0][1] - free_x) < abs(signs[0][1] - target_x)
