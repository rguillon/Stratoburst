import pytest

from scorched_core.entities.player_life import PlayerLife
from scorched_core.entities.player_phase import PlayerPhase
from scorched_core.events.event_ring import EventRing
from scorched_core.protocol import EV_GAME_OVER, EVENT_STRIDE
from scorched_core.scoring.score_keeper import ScoreKeeper
from scorched_core.stages.flow_state import FlowState
from scorched_core.stages.stage_flow import StageFlow


def make() -> StageFlow:
    return StageFlow(life=PlayerLife(), score=ScoreKeeper(), events=EventRing())


def record(flow: StageFlow, index: int) -> list[float]:
    base = index * EVENT_STRIDE
    return [float(flow.events.buf[base + k]) for k in range(EVENT_STRIDE)]


def test_a_new_flow_is_playing_with_nothing_requested() -> None:
    flow = make()
    assert flow.state == FlowState.PLAY
    assert flow.timer == 0
    assert flow.save_requested is False
    assert flow.spawning is True


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


def test_reset_returns_to_play_and_forgets_the_request() -> None:
    flow = make()
    flow.life.phase = PlayerPhase.OUT
    flow.step()
    flow.step()
    flow.reset()
    assert (flow.state, flow.timer, flow.save_requested) == (FlowState.PLAY, 0, False)
    assert flow.spawning is True


def test_an_unhandled_state_fails_loudly() -> None:
    flow = make()
    flow.state = 99  # type: ignore[assignment]
    with pytest.raises(ValueError, match="unknown flow state 99"):
        flow.step()
