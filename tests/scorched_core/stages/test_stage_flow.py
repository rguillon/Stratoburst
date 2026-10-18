import pytest
from scorched_core.bosses.stage_1_bosses import MIDBOSS_1

from scorched_core.bosses.boss_state import BossState
from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.player_life import PlayerLife
from scorched_core.entities.player_phase import PlayerPhase
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import EV_GAME_OVER, EV_STAGE_START, EVENT_STRIDE
from scorched_core.scoring.score_keeper import ScoreKeeper
from scorched_core.stages.flow_state import FlowState
from scorched_core.stages.stage_data import StageData
from scorched_core.stages.stage_flow import StageFlow
from scorched_core.stages.terrain_scroll import TerrainScroll
from scorched_core.tuning import (
    ENEMY_MAX_ALIVE,
    INTRO_TICKS,
    MIDBOSS_CRAWL_SPEED,
    SCROLL_SPEED,
)


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


MARKER = 100.0
_BOSS_STAGE = StageData(
    number=1, length=1000.0, waves=(), markers=(("midboss", MARKER),), midboss=MIDBOSS_1
)


def make_boss_flow(stage: StageData | None = _BOSS_STAGE, distance: float = 0.0) -> StageFlow:
    """A PLAY flow wired to its terrain and enemy pool, the terrain at ``distance``."""
    return StageFlow(
        life=PlayerLife(),
        score=ScoreKeeper(),
        events=EventRing(),
        state=FlowState.PLAY,
        terrain=TerrainScroll(distance=distance),
        enemies=EnemyPool(),
        stage=stage,
    )


def test_a_flow_without_a_stage_never_starts_a_midboss() -> None:
    flow = make_boss_flow(stage=None, distance=MARKER)
    flow.step()
    assert (flow.state, flow.boss) == (FlowState.PLAY, None)
    assert flow.enemies.n == 0


def test_a_stage_without_midboss_data_never_starts_one() -> None:
    stage = StageData(number=1, length=1000.0, waves=(), markers=(("midboss", MARKER),))
    flow = make_boss_flow(stage, distance=MARKER)
    flow.step()
    assert (flow.state, flow.boss) == (FlowState.PLAY, None)


def test_play_before_the_midboss_marker_leaves_the_flow_alone() -> None:
    flow = make_boss_flow(distance=MARKER - 0.5)
    flow.step()
    assert (flow.state, flow.boss) == (FlowState.PLAY, None)
    assert flow.terrain.target == SCROLL_SPEED


def test_reaching_the_midboss_marker_brings_in_the_train_and_slows_the_terrain() -> None:
    flow = make_boss_flow(distance=MARKER)
    flow.step()
    assert flow.state == FlowState.MIDBOSS
    assert flow.boss is not None
    assert flow.boss.slot == 1
    assert flow.boss.spec is MIDBOSS_1
    assert flow.boss.active
    assert flow.terrain.target == MIDBOSS_CRAWL_SPEED
    assert flow.enemies.n == 3  # the hull and its two turrets
    assert int(flow.enemies.kind[0]) == EnemyKind.TRAIN
    assert flow.spawning is True


def test_the_midboss_waits_in_the_flow_while_the_fight_runs() -> None:
    flow = make_boss_flow(distance=MARKER)
    flow.step()
    boss = flow.boss
    for _ in range(50):
        flow.step()
    assert (flow.state, flow.boss) == (FlowState.MIDBOSS, boss)
    assert flow.terrain.target == MIDBOSS_CRAWL_SPEED


def test_a_gone_midboss_returns_to_play_at_full_scroll_speed_and_never_starts_twice() -> None:
    flow = make_boss_flow(distance=MARKER)
    flow.step()
    assert flow.boss is not None
    flow.boss.state = BossState.GONE
    flow.step()
    assert flow.state == FlowState.PLAY
    assert flow.boss is None
    assert flow.terrain.target == SCROLL_SPEED
    for _ in range(5):  # still inside the trigger window: it must not start again
        flow.step()
    assert (flow.state, flow.boss) == (FlowState.PLAY, None)


def test_a_marker_the_run_already_jumped_past_does_not_start_the_midboss() -> None:
    flow = make_boss_flow(distance=MARKER + 1000.0)
    flow.step()
    assert (flow.state, flow.boss) == (FlowState.PLAY, None)


def test_a_full_enemy_pool_delays_the_midboss_until_it_has_room() -> None:
    flow = make_boss_flow(distance=MARKER)
    for _ in range(ENEMY_MAX_ALIVE):
        flow.enemies.spawn(EnemyKind.JET, 10.0, 10.0, 0, 0.0, 0.0)
    flow.step()
    assert (flow.state, flow.boss) == (FlowState.PLAY, None)
    assert flow.terrain.target == SCROLL_SPEED
    flow.enemies.clear()
    flow.step()
    assert flow.state == FlowState.MIDBOSS


def test_reset_drops_the_midboss_so_a_new_run_triggers_it_again() -> None:
    flow = make_boss_flow(distance=MARKER)
    flow.step()
    flow.boss.state = BossState.GONE
    flow.step()
    flow.reset()
    assert flow.boss is None
    flow.state = FlowState.PLAY
    flow.enemies.clear()
    flow.step()
    assert flow.state == FlowState.MIDBOSS


def test_reset_during_the_fight_clears_the_controller() -> None:
    flow = make_boss_flow(distance=MARKER)
    flow.step()
    flow.reset()
    assert flow.boss is None
    assert flow.state == FlowState.INTRO


def test_game_over_during_the_midboss_wins_over_every_boss_transition() -> None:
    flow = make_boss_flow(distance=MARKER)
    flow.step()
    assert flow.boss is not None
    flow.boss.state = BossState.GONE  # the fight ends on the very step the last ship is lost
    flow.life.phase = PlayerPhase.OUT
    flow.step()
    assert flow.state == FlowState.GAME_OVER
    assert flow.boss is None
    assert flow.save_requested is True
    assert flow.spawning is False
    for _ in range(5):
        flow.step()
    assert flow.state == FlowState.GAME_OVER


def test_a_dying_ship_does_not_stop_the_midboss() -> None:
    flow = make_boss_flow(distance=MARKER)
    flow.step()
    for phase in (PlayerPhase.GRACE, PlayerPhase.DYING, PlayerPhase.RESPAWN):
        flow.life.phase = phase
        flow.step()
        assert flow.state == FlowState.MIDBOSS
