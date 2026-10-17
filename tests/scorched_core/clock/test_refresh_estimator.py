import pytest

from scorched_core.clock.fixed_step_runner import STEP_MS
from scorched_core.clock.refresh_estimator import (
    MIN_SAMPLES,
    STANDARD_RATES_HZ,
    WINDOW,
    RefreshEstimator,
)


def fed(period: float, count: int) -> RefreshEstimator:
    estimator = RefreshEstimator()
    for _ in range(count):
        estimator.snap(period)
    return estimator


def test_the_standard_rates_cover_common_displays() -> None:
    assert STANDARD_RATES_HZ == (30, 60, 72, 90, 120, 144, 165, 240)


def test_fewer_than_three_samples_return_dt_unchanged() -> None:
    estimator = RefreshEstimator()
    assert MIN_SAMPLES == 3
    assert estimator.snap(16.9) == 16.9
    assert estimator.snap(16.4) == 16.4


def test_the_third_sample_is_already_snapped() -> None:
    estimator = RefreshEstimator()
    estimator.snap(16.9)
    estimator.snap(16.4)
    assert estimator.snap(16.8) == STEP_MS


def test_a_zero_dt_returns_zero_and_is_not_recorded() -> None:
    estimator = RefreshEstimator()
    assert estimator.snap(0.0) == 0.0
    assert estimator.snap(0.0) == 0.0
    assert estimator.snap(0.0) == 0.0
    # Three zero dts left the window empty, so the next two samples are still unsnapped.
    assert estimator.snap(16.9) == 16.9
    assert estimator.snap(16.4) == 16.4


def test_a_negative_dt_is_passed_through_unrecorded() -> None:
    estimator = fed(STEP_MS, 5)
    assert estimator.snap(-3.0) == -3.0


def test_a_jittery_dt_snaps_to_the_standard_rate_period() -> None:
    estimator = fed(16.4, 10)
    assert estimator.snap(16.9) == STEP_MS


def test_a_dt_near_two_periods_snaps_to_exactly_two_periods() -> None:
    estimator = fed(STEP_MS, 10)
    assert estimator.snap(STEP_MS * 2.2) == 2 * STEP_MS
    assert estimator.snap(STEP_MS * 1.8) == 2 * STEP_MS


def test_a_dt_forty_percent_off_a_period_multiple_is_unchanged() -> None:
    estimator = fed(STEP_MS, 10)
    dt = STEP_MS * 1.4
    assert estimator.snap(dt) == dt


def test_a_dt_just_inside_the_snap_tolerance_snaps_and_just_outside_does_not() -> None:
    estimator = fed(STEP_MS, 10)
    assert estimator.snap(STEP_MS * 1.24) == STEP_MS
    assert estimator.snap(STEP_MS * 1.26) == STEP_MS * 1.26


def test_a_median_within_one_and_a_half_percent_of_a_standard_rate_snaps_to_it() -> None:
    estimator = fed(16.5, 10)  # 1% below 16.6667
    assert estimator.snap(16.5) == 1000.0 / 60.0
    estimator = fed(8.4, 10)  # 0.8% above 120 Hz
    assert estimator.snap(8.4) == 1000.0 / 120.0


def test_a_median_outside_every_rate_tolerance_keeps_its_own_period() -> None:
    estimator = fed(20.0, 10)  # 50 Hz is not a standard rate
    assert estimator.snap(20.2) == 20.0


def test_one_slow_frame_does_not_move_the_median() -> None:
    estimator = fed(STEP_MS, 10)
    estimator.snap(60.0)
    assert estimator.snap(STEP_MS * 1.1) == STEP_MS


def test_the_window_forgets_samples_older_than_fifteen() -> None:
    estimator = fed(STEP_MS, WINDOW)
    for _ in range(WINDOW):
        estimator.snap(1000.0 / 30.0)
    assert estimator.snap(1000.0 / 30.0 * 1.1) == 1000.0 / 30.0


def test_an_even_sample_count_uses_the_mean_of_the_middle_pair() -> None:
    estimator = RefreshEstimator()
    estimator.snap(20.0)
    estimator.snap(20.0)
    estimator.snap(24.0)
    # Window 20, 20, 24, 24: the middle pair is 20 and 24, so the period is 22.
    assert estimator.snap(24.0) == 22.0


def test_reset_empties_the_window() -> None:
    estimator = fed(STEP_MS, 10)
    estimator.reset()
    assert estimator.snap(16.9) == 16.9
    assert estimator.snap(16.4) == 16.4


@pytest.mark.parametrize("hz", STANDARD_RATES_HZ)
def test_every_standard_rate_snaps_to_its_exact_period(hz: int) -> None:
    period = 1000.0 / hz
    estimator = fed(period * 1.005, 10)
    assert estimator.snap(period * 1.004) == period
