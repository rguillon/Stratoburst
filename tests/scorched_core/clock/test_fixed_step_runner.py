import pytest

from scorched_core.clock.fixed_step_runner import MAX_STEPS, STEP_MS, FixedStepRunner


def make() -> tuple[FixedStepRunner, list[int]]:
    calls: list[int] = []
    return FixedStepRunner(lambda: calls.append(1)), calls


def test_exact_step_runs_once() -> None:
    runner, calls = make()
    assert runner.advance(STEP_MS) == 1
    assert len(calls) == 1


def test_just_under_a_step_runs_nothing() -> None:
    runner, calls = make()
    assert runner.advance(STEP_MS - 2e-6) == 0
    assert calls == []


@pytest.mark.parametrize("dt", [100.0, 5000.0])
def test_large_dt_is_bounded_and_drops_backlog(dt: float) -> None:
    runner, calls = make()
    assert runner.advance(dt) == MAX_STEPS
    assert len(calls) == MAX_STEPS
    assert runner.acc == 0.0


def test_alpha_after_half_a_step() -> None:
    runner, _ = make()
    runner.advance(STEP_MS / 2)
    assert runner.alpha == pytest.approx(0.5)


def test_alpha_is_clamped() -> None:
    runner, _ = make()
    runner.acc = -5.0
    assert runner.alpha == 0.0
    runner.acc = STEP_MS * 3
    assert runner.alpha == 1.0


def test_reset_zeroes_accumulator() -> None:
    runner, _ = make()
    runner.advance(STEP_MS / 2)
    runner.reset()
    assert runner.acc == 0.0
