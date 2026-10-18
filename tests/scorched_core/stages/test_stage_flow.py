import pytest

from scorched_core.entities.player_life import PlayerLife
from scorched_core.entities.player_phase import PlayerPhase
from scorched_core.events.event_ring import EventRing
from scorched_core.protocol import EV_GAME_OVER, EV_STAGE_START, EVENT_STRIDE
from scorched_core.scoring.score_keeper import ScoreKeeper
from scorched_core.stages.flow_state import FlowState
from scorched_core.stages.stage_flow import StageFlow
from scorched_core.tuning import INTRO_TICKS


def make(state: FlowState = FlowState.PLAY, stage_number: int = 1) -> StageFlow:
    return StageFlow(
        life=PlayerLife(),
        score=ScoreKeeper(),
        events=EventRing(),
        state=state,
        stage_number=stage_number,
    )


def record(flow: StageFlow, index: int) -> list[float]:
    base = index * EVENT_STRIDE
    return [float(flow.events.buf[base + k]) for k in range(EVENT_STRIDE)]


def test_a_new_flow_opens_with_the_intro_and_nothing_requested() -> None:
    flow = StageFlow(life=PlayerLife(), score=ScoreKeeper(), events=EventRing())
    assert flow.state == FlowState.INTRO
    assert flow.timer == 0
    assert flow.progress == 0.0
    assert flow.save_requested is False
    assert flow.spawning is True


def test_the_first_intro_step_pushes_one_stage_start_with_the_stage_number() -> None:
    flow = make(FlowState.INTRO, stage_number=3)
    flow.step()
    assert flow.events.n == 1
    kind, _, _, number, _, _ = record(flow, 0)
    assert (kind, number) == (EV_STAGE_START, 3.0)
    for _ in range(INTRO_TICKS - 2):
        flow.step()
    assert flow.events.n == 1


def test_the_intro_progress_rises_from_zero_to_one_and_play_follows() -> None:
    flow = make(FlowState.INTRO)
    assert INTRO_TICKS == 120
    flow.step()
    assert flow.progress == pytest.approx(1 / INTRO_TICKS)
    for _ in range(INTRO_TICKS // 2 - 1):
        flow.step()
    assert flow.state == FlowState.INTRO
    assert flow.progress == pytest.approx(0.5)
    for _ in range(INTRO_TICKS // 2 - 1):
        flow.step()
    assert flow.state == FlowState.INTRO
    flow.step()
    assert flow.state == FlowState.PLAY
    assert flow.progress == 0.0
    assert flow.spawning is True


def test_reset_returns_to_the_intro_so_the_next_run_pushes_stage_start_again() -> None:
    flow = make(FlowState.INTRO)
    for _ in range(INTRO_TICKS + 5):
        flow.step()
    flow.events.clear()
    flow.reset()
    assert (flow.state, flow.timer, flow.progress) == (FlowState.INTRO, 0, 0.0)
    flow.step()
    assert flow.events.n == 1


def test_a_step_while_the_ship_lives_changes_nothing() -> None:
    flow = make()
    for phase in (PlayerPhase.ALIVE, PlayerPhase.GRACE, PlayerPhase.DYING, PlayerPhase.RESPAWN):
        flow.life.phase = phase
        flow.step()
        assert flow.state == FlowState.PLAY
    assert flow.events.n == 0
    assert flow.save_requested is False


def test_the_first_step_in_out_ends_the_game_with_one_event_and_a_save_request() -> None:
    flow = make()
    flow.score.score = 12_345
    flow.score.best_at_start = 20_000
    flow.life.phase = PlayerPhase.OUT
    flow.step()
    assert flow.state == FlowState.GAME_OVER
    assert flow.save_requested is True
    assert flow.spawning is False
    assert flow.events.n == 1
    kind, _, _, score, record_flag, _ = record(flow, 0)
    assert (kind, score, record_flag) == (EV_GAME_OVER, 12_345.0, 0.0)


def test_the_event_carries_the_new_record_flag() -> None:
    flow = make()
    flow.score.score = 500
    flow.life.phase = PlayerPhase.OUT
    assert flow.score.new_record
    flow.step()
    assert record(flow, 0)[4] == 1.0


def test_later_steps_push_no_second_event() -> None:
    flow = make()
    flow.life.phase = PlayerPhase.OUT
    flow.step()
    flow.events.clear()
    for _ in range(600):
        flow.step()
    assert flow.events.n == 0
    assert flow.state == FlowState.GAME_OVER


def test_the_timer_counts_the_steps_since_the_game_ended() -> None:
    flow = make()
    flow.life.phase = PlayerPhase.OUT
    flow.step()
    assert flow.timer == 0
    flow.step()
    flow.step()
    assert flow.timer == 2


def test_reset_returns_to_the_intro_and_forgets_the_request() -> None:
    flow = make()
    flow.life.phase = PlayerPhase.OUT
    flow.step()
    flow.step()
    flow.reset()
    assert (flow.state, flow.timer, flow.save_requested) == (FlowState.INTRO, 0, False)
    assert flow.spawning is True


def test_an_unhandled_state_fails_loudly() -> None:
    flow = make()
    flow.state = 99  # type: ignore[assignment]
    with pytest.raises(ValueError, match="unknown flow state 99"):
        flow.step()
