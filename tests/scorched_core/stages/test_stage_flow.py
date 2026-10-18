import pytest

from scorched_core.bosses.boss_state import BossState
from scorched_core.bosses.stage_1_bosses import BOMBER_1, MIDBOSS_1
from scorched_core.entities.enemy_kind import EnemyKind
from scorched_core.entities.player_life import PlayerLife
from scorched_core.entities.player_phase import PlayerPhase
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import (
    EV_BOSS_WARNING,
    EV_EXPLOSION,
    EV_EXTEND,
    EV_GAME_OVER,
    EV_STAGE_CLEAR,
    EV_STAGE_START,
    EV_TALLY_LINE,
    EVENT_SOFT_CAP,
    EVENT_STRIDE,
)
from scorched_core.scoring.medal_chain import MedalChain
from scorched_core.scoring.score_keeper import ScoreKeeper
from scorched_core.stages.flow_state import FlowState
from scorched_core.stages.stage_data import StageData
from scorched_core.stages.stage_flow import StageFlow
from scorched_core.stages.terrain_scroll import TerrainScroll
from scorched_core.tuning import (
    BOSS_CRAWL_SPEED,
    CLEAR_TICKS,
    ENEMY_MAX_ALIVE,
    EXTEND_FIRST,
    INTRO_TICKS,
    MIDBOSS_CRAWL_SPEED,
    SCROLL_SPEED,
    STAGE_CLEAR_TICKS,
    TALLY_HOLD_TICKS,
    TALLY_LINE_TICKS,
    WARNING_TICKS,
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


# --- the boss: WARNING, BOSS and CLEAR (plan 03-19) ----------------------------------------------

BOSS_MARKER = 200.0
_BOMBER_STAGE = StageData(
    number=1, length=1000.0, waves=(), markers=(("boss", BOSS_MARKER),), boss=BOMBER_1
)


def make_bomber_flow(
    stage: StageData | None = _BOMBER_STAGE, distance: float = BOSS_MARKER
) -> StageFlow:
    """A PLAY flow wired to its terrain, enemies and enemy bullets, the terrain at ``distance``."""
    return StageFlow(
        life=PlayerLife(),
        score=ScoreKeeper(),
        events=EventRing(),
        state=FlowState.PLAY,
        terrain=TerrainScroll(distance=distance),
        enemies=EnemyPool(),
        ebullets=BulletPool(50),
        stage=stage,
    )


def start_boss(flow: StageFlow) -> None:
    """Step a PLAY flow through its WARNING into the BOSS state."""
    flow.step()
    for _ in range(WARNING_TICKS):
        flow.step()
    assert flow.state == FlowState.BOSS


def test_a_flow_without_boss_data_never_warns() -> None:
    stage = StageData(number=1, length=1000.0, waves=(), markers=(("boss", BOSS_MARKER),))
    for candidate in (None, stage):
        flow = make_bomber_flow(candidate)
        flow.step()
        assert (flow.state, flow.boss) == (FlowState.PLAY, None)


def test_play_before_the_boss_marker_leaves_the_flow_alone() -> None:
    flow = make_bomber_flow(distance=BOSS_MARKER - 0.5)
    flow.step()
    assert flow.state == FlowState.PLAY
    assert flow.events.n == 0


def test_a_marker_the_run_already_jumped_past_does_not_raise_the_warning() -> None:
    flow = make_bomber_flow(distance=BOSS_MARKER + 1000.0)
    flow.step()
    assert flow.state == FlowState.PLAY


def test_the_boss_marker_raises_one_warning_and_slows_the_scroll_to_the_boss_crawl() -> None:
    flow = make_bomber_flow()
    flow.step()
    assert flow.state == FlowState.WARNING
    assert flow.events.n == 1
    kind, *_ = record(flow, 0)
    assert kind == EV_BOSS_WARNING
    assert flow.terrain.target == BOSS_CRAWL_SPEED
    assert (flow.boss, flow.timer, flow.progress) == (None, 0, 0.0)
    assert flow.spawning is False  # the director stops: the boss room holds no new enemies
    assert flow.boss_destroyed is False


def test_the_warning_progress_rises_from_zero_to_one_over_the_warning_ticks() -> None:
    flow = make_bomber_flow()
    flow.step()
    assert WARNING_TICKS == 180
    for _ in range(WARNING_TICKS // 2):
        flow.step()
    assert flow.state == FlowState.WARNING
    assert flow.progress == pytest.approx(0.5)
    for _ in range(WARNING_TICKS // 2 - 1):
        flow.step()
    assert flow.state == FlowState.WARNING
    assert flow.progress == pytest.approx((WARNING_TICKS - 1) / WARNING_TICKS)
    assert flow.events.n == 1  # still just the one BOSS_WARNING


def test_after_the_warning_the_bomber_starts_in_boss_slot_two() -> None:
    flow = make_bomber_flow()
    start_boss(flow)
    assert flow.boss is not None
    assert (flow.boss.slot, flow.boss.spec, flow.boss.active) == (2, BOMBER_1, True)
    assert flow.enemies.n == 1 + len(BOMBER_1.parts)
    assert int(flow.enemies.kind[0]) == EnemyKind.BOMBER
    assert flow.spawning is False
    assert flow.terrain.target == BOSS_CRAWL_SPEED
    assert flow.progress == 0.0
    assert flow.events.n == 1


def test_a_full_enemy_pool_holds_the_bomber_back_at_the_end_of_the_warning() -> None:
    flow = make_bomber_flow()
    for _ in range(ENEMY_MAX_ALIVE):
        flow.enemies.spawn(EnemyKind.JET, 10.0, 10.0, 0, 0.0, 0.0)
    flow.step()
    for _ in range(WARNING_TICKS + 20):
        flow.step()
    assert (flow.state, flow.boss) == (FlowState.WARNING, None)
    assert flow.progress == 1.0  # the bar stays full while it waits
    flow.enemies.clear()
    flow.step()
    assert flow.state == FlowState.BOSS
    assert flow.boss is not None


def test_the_bomber_waits_in_the_flow_while_the_fight_runs() -> None:
    flow = make_bomber_flow()
    start_boss(flow)
    boss = flow.boss
    for _ in range(50):
        flow.step()
    assert (flow.state, flow.boss) == (FlowState.BOSS, boss)


@pytest.mark.parametrize("destroyed", [True, False])
def test_a_gone_bomber_moves_the_flow_to_clear_and_records_whether_it_was_destroyed(
    destroyed: bool,
) -> None:
    flow = make_bomber_flow()
    start_boss(flow)
    assert flow.boss is not None
    flow.boss._destroyed = destroyed
    flow.boss.state = BossState.GONE
    flow.step()
    assert flow.state == FlowState.CLEAR
    assert flow.boss_destroyed is destroyed
    assert flow.boss is None
    assert flow.timer == 0
    assert flow.spawning is False


def test_clear_explodes_every_remaining_enemy_unpaid_and_clears_the_enemy_bullets() -> None:
    flow = make_bomber_flow()
    start_boss(flow)
    assert flow.boss is not None
    flow.boss.state = BossState.GONE
    flow.enemies.clear()  # what the controller leaves behind: only the stage's own rows
    flow.enemies.spawn(EnemyKind.JET, 40.0, 50.0, 0, 0.0, 0.0)
    flow.enemies.spawn(EnemyKind.TANK, 90.0, 120.0, 0, 0.0, 0.0)
    flow.ebullets.spawn(10.0, 10.0, 0.0, 1.0)
    flow.ebullets.spawn(20.0, 10.0, 0.0, 1.0)
    flow.events.clear()
    kills = flow.enemies.kills
    flow.step()
    assert flow.enemies.n == 0
    assert flow.ebullets.n == 0
    assert flow.enemies.kills == kills  # explosions without kills: no points, no drops
    assert flow.enemies.kill_n == 0
    assert sorted(record(flow, i)[0] for i in range(flow.events.n)) == [EV_EXPLOSION] * 2
    assert flow.score.score == 0


def test_clear_holds_and_pushes_nothing_more() -> None:
    flow = make_bomber_flow()
    start_boss(flow)
    assert flow.boss is not None
    flow.boss.state = BossState.GONE
    flow.step()
    flow.events.clear()
    for _ in range(CLEAR_TICKS - 1):
        flow.step()
    assert flow.state == FlowState.CLEAR
    assert flow.events.n == 0
    assert flow.terrain.target == BOSS_CRAWL_SPEED


def test_clear_explosions_are_low_priority_so_a_nearly_full_ring_refuses_them() -> None:
    flow = make_bomber_flow()
    start_boss(flow)
    assert flow.boss is not None
    flow.boss.state = BossState.GONE
    flow.enemies.clear()
    flow.enemies.spawn(EnemyKind.JET, 40.0, 50.0, 0, 0.0, 0.0)
    flow.events.n = EVENT_SOFT_CAP
    flow.step()
    assert (flow.state, flow.enemies.n, flow.events.n) == (FlowState.CLEAR, 0, EVENT_SOFT_CAP)


def test_game_over_during_the_warning_wins() -> None:
    flow = make_bomber_flow()
    flow.step()
    flow.life.phase = PlayerPhase.OUT
    flow.step()
    assert flow.state == FlowState.GAME_OVER
    assert flow.save_requested is True
    assert flow.spawning is False
    for _ in range(WARNING_TICKS + 10):  # the warning clock is dead: no bomber ever starts
        flow.step()
    assert (flow.state, flow.boss) == (FlowState.GAME_OVER, None)
    assert flow.enemies.n == 0


def test_game_over_during_the_boss_fight_wins_over_the_bomber_leaving() -> None:
    flow = make_bomber_flow()
    start_boss(flow)
    assert flow.boss is not None
    flow.boss.state = BossState.GONE  # the fight ends on the very step the last ship is lost
    flow.life.phase = PlayerPhase.OUT
    flow.step()
    assert flow.state == FlowState.GAME_OVER
    assert flow.boss is None
    for _ in range(5):
        flow.step()
    assert flow.state == FlowState.GAME_OVER


def test_a_dying_ship_does_not_stop_the_warning_or_the_boss() -> None:
    flow = make_bomber_flow()
    flow.step()
    for phase in (PlayerPhase.GRACE, PlayerPhase.DYING, PlayerPhase.RESPAWN):
        flow.life.phase = phase
        flow.step()
        assert flow.state == FlowState.WARNING
    flow.life.phase = PlayerPhase.ALIVE
    start_boss_state = flow.timer
    for _ in range(WARNING_TICKS - start_boss_state):
        flow.step()
    assert flow.state == FlowState.BOSS
    for phase in (PlayerPhase.GRACE, PlayerPhase.DYING, PlayerPhase.RESPAWN):
        flow.life.phase = phase
        flow.step()
        assert flow.state == FlowState.BOSS


def test_a_ship_lost_during_the_clear_ends_the_run_instead_of_the_stage() -> None:
    flow = make_bomber_flow()
    start_boss(flow)
    assert flow.boss is not None
    flow.boss.state = BossState.GONE
    flow.step()
    assert flow.state == FlowState.CLEAR
    flow.life.phase = PlayerPhase.OUT
    flow.step()
    assert flow.state == FlowState.GAME_OVER
    assert flow.save_requested is True


def test_reset_forgets_the_warning_the_bomber_and_the_verdict() -> None:
    flow = make_bomber_flow()
    start_boss(flow)
    assert flow.boss is not None
    flow.boss._destroyed = True
    flow.boss.state = BossState.GONE
    flow.step()
    assert flow.boss_destroyed is True
    flow.reset()
    assert (flow.state, flow.boss, flow.boss_destroyed, flow.timer) == (
        FlowState.INTRO,
        None,
        False,
        0,
    )
    assert flow.spawning is True
    flow.state = FlowState.PLAY
    flow.enemies.clear()
    flow.step()
    assert flow.state == FlowState.WARNING  # the marker triggers again in a new run


def test_the_midboss_marker_does_not_raise_the_warning_and_the_two_fights_can_share_a_stage() -> (
    None
):
    stage = StageData(
        number=1,
        length=1000.0,
        waves=(),
        markers=(("midboss", MARKER), ("boss", BOSS_MARKER)),
        midboss=MIDBOSS_1,
        boss=BOMBER_1,
    )
    flow = make_bomber_flow(stage, distance=MARKER)
    flow.step()
    assert flow.state == FlowState.MIDBOSS
    assert flow.boss is not None
    assert flow.boss.slot == 1
    flow.boss.state = BossState.GONE
    flow.step()
    assert flow.state == FlowState.PLAY
    flow.terrain.distance = BOSS_MARKER
    flow.step()
    assert flow.state == FlowState.WARNING


def test_a_boss_state_with_no_controller_clears_as_not_destroyed() -> None:
    flow = make_bomber_flow()
    flow.state = FlowState.BOSS
    flow.step()
    assert flow.state == FlowState.CLEAR
    assert flow.boss_destroyed is False


# --- the stage-clear tally (plan 03-21) ----------------------------------------------------------


def make_clear_flow(
    *, destroyed: bool = True, medals: int = 0, bombs: int = 0, deaths: int = 0
) -> StageFlow:
    """A flow just inside CLEAR: ``medals`` caught, ``deaths`` ships lost, ``bombs`` left."""
    flow = make(FlowState.CLEAR)
    flow.chain = MedalChain(collected=medals)
    flow.get_bombs = lambda: bombs
    flow.life.deaths = deaths
    flow.boss_destroyed = destroyed
    return flow


def enter_tally(flow: StageFlow) -> None:
    """Step a CLEAR flow through its hold into the first TALLY state, no line revealed yet."""
    for _ in range(CLEAR_TICKS):
        flow.step()
    assert flow.state == FlowState.TALLY
    flow.events.clear()


def tally_lines(flow: StageFlow) -> list[tuple[int, int]]:
    """Every TALLY_LINE event in the ring as (index, amount)."""
    found = []
    for i in range(flow.events.n):
        kind, _, _, index, amount, _ = record(flow, i)
        if kind == EV_TALLY_LINE:
            found.append((int(index), int(amount)))
    return found


def test_the_tally_constants_pin_the_timing_of_the_design() -> None:
    assert (CLEAR_TICKS, TALLY_LINE_TICKS, TALLY_HOLD_TICKS) == (120, 60, 120)


def test_clear_holds_for_clear_ticks_and_then_the_tally_begins() -> None:
    flow = make_clear_flow()
    for _ in range(CLEAR_TICKS - 1):
        flow.step()
        assert flow.state == FlowState.CLEAR
    flow.step()
    assert flow.state == FlowState.TALLY
    assert flow.timer == 0
    assert flow.spawning is False


def test_a_flow_has_an_empty_tally_until_the_tally_begins() -> None:
    flow = make_clear_flow(medals=3)
    assert flow.tally.amounts == [0, 0, 0, 0]
    flow.step()
    assert flow.tally.amounts == [0, 0, 0, 0]


def test_the_tally_is_worked_out_from_the_stage_results_when_it_begins() -> None:
    flow = make_clear_flow(destroyed=True, medals=7, bombs=2, deaths=0)
    enter_tally(flow)
    assert flow.tally.amounts == [100_000, 7_000, 50_000, 20_000]
    assert flow.tally.revealed == 0


def test_a_retreated_boss_a_lost_ship_and_no_bombs_pay_zero_on_their_lines() -> None:
    flow = make_clear_flow(destroyed=False, medals=2, bombs=0, deaths=0)
    flow.life.deaths = 1  # a ship lost this stage
    enter_tally(flow)
    assert flow.tally.amounts == [0, 2_000, 0, 0]


def test_the_bomb_line_counts_the_bombs_in_stock_when_the_tally_begins() -> None:
    stock = [3]
    flow = make_clear_flow()
    flow.get_bombs = lambda: stock[0]
    for _ in range(CLEAR_TICKS - 1):
        flow.step()
    stock[0] = 1  # a bomb used during the last step of the hold
    flow.step()
    assert flow.tally.amounts[3] == 10_000


def test_deaths_and_medals_are_counted_from_the_start_of_the_stage() -> None:
    flow = make(FlowState.INTRO)
    flow.chain = MedalChain(collected=9)
    flow.life.deaths = 4  # lost in an earlier loop
    flow.step()  # the first INTRO step re-bases both counters
    assert flow.chain.collected == 0
    flow.state = FlowState.CLEAR
    flow.chain.collected = 2
    flow.boss_destroyed = True
    enter_tally(flow)
    assert flow.tally.amounts == [100_000, 2_000, 50_000, 0]
    flow2 = make(FlowState.INTRO)
    flow2.life.deaths = 4
    flow2.step()
    flow2.life.deaths = 5  # and one ship lost during this stage
    flow2.state = FlowState.CLEAR
    enter_tally(flow2)
    assert flow2.tally.amounts[2] == 0


def test_the_first_line_is_revealed_at_once_and_one_more_every_line_interval() -> None:
    flow = make_clear_flow(medals=7, bombs=2)
    enter_tally(flow)
    expected = [(0, 100_000), (1, 7_000), (2, 50_000), (3, 20_000)]
    for line, pair in enumerate(expected):
        flow.events.clear()
        flow.step()
        assert flow.tally.revealed == line + 1
        assert tally_lines(flow) == [pair]
        for _ in range(TALLY_LINE_TICKS - 1):
            flow.events.clear()
            flow.step()
            assert tally_lines(flow) == []
            assert flow.state == FlowState.TALLY


def test_each_revealed_line_is_added_to_the_score_exactly_once() -> None:
    flow = make_clear_flow(medals=7, bombs=2)
    enter_tally(flow)
    scores = []
    for _ in range(3 * TALLY_LINE_TICKS + 1):
        flow.step()
        if not scores or scores[-1] != flow.score.score:
            scores.append(flow.score.score)
    assert scores == [100_000, 107_000, 157_000, 177_000]
    for _ in range(TALLY_HOLD_TICKS + 5):
        flow.step()
    assert flow.score.score == 177_000


def test_a_line_that_crosses_an_extend_threshold_grants_the_ship() -> None:
    flow = make_clear_flow()
    flow.score.score = EXTEND_FIRST - 1
    lives = flow.score.lives
    enter_tally(flow)
    flow.step()  # the boss line, 100000 on top of a score just under the threshold
    assert flow.score.lives == lives + 1
    kinds = [record(flow, i)[0] for i in range(flow.events.n)]
    assert EV_EXTEND in kinds
    assert EV_TALLY_LINE in kinds


def test_an_all_zero_tally_still_reveals_four_lines() -> None:
    flow = make_clear_flow(destroyed=False, medals=0, bombs=0)
    flow.life.deaths = 1
    enter_tally(flow)
    seen = []
    for _ in range(3 * TALLY_LINE_TICKS + 1):
        flow.step()
        seen.extend(tally_lines(flow))
        flow.events.clear()
    assert seen == [(0, 0), (1, 0), (2, 0), (3, 0)]
    assert flow.score.score == 0


def test_the_tally_holds_after_the_fourth_line_and_then_the_stage_clear_follows() -> None:
    flow = make_clear_flow()
    enter_tally(flow)
    for _ in range(3 * TALLY_LINE_TICKS + 1):
        flow.step()
    assert flow.tally.revealed == 4
    for _ in range(TALLY_HOLD_TICKS - 1):
        flow.step()
        assert flow.state == FlowState.TALLY
    flow.step()
    assert flow.state == FlowState.STAGE_CLEAR
    assert flow.spawning is False


def test_the_tally_amounts_stay_until_the_stage_clear_restarts_the_stage() -> None:
    flow = make_clear_flow(medals=1)
    enter_tally(flow)
    for _ in range(3 * TALLY_LINE_TICKS + 1 + TALLY_HOLD_TICKS):
        flow.step()
    assert flow.state == FlowState.STAGE_CLEAR
    assert flow.tally.amounts == [100_000, 1_000, 50_000, 0]
    assert flow.tally.revealed == 4


def test_game_over_during_the_tally_wins_and_forgets_it() -> None:
    flow = make_clear_flow(medals=3)
    enter_tally(flow)
    flow.step()
    assert flow.tally.revealed == 1
    flow.life.phase = PlayerPhase.OUT
    flow.step()
    assert flow.state == FlowState.GAME_OVER
    assert flow.tally.amounts == [0, 0, 0, 0]
    assert flow.tally.revealed == 0


def test_reset_forgets_the_tally() -> None:
    flow = make_clear_flow(medals=3)
    enter_tally(flow)
    flow.step()
    flow.reset()
    assert flow.tally.amounts == [0, 0, 0, 0]
    assert flow.tally.revealed == 0


# --- STAGE CLEAR and the D-27 loop (plan 03-21) -------------------------------------------------


def enter_stage_clear(flow: StageFlow) -> None:
    """Step a CLEAR flow all the way through its tally into STAGE_CLEAR."""
    for _ in range(CLEAR_TICKS + 3 * TALLY_LINE_TICKS + 1 + TALLY_HOLD_TICKS):
        flow.step()
    assert flow.state == FlowState.STAGE_CLEAR


def kinds_in_ring(flow: StageFlow) -> list[float]:
    return [record(flow, i)[0] for i in range(flow.events.n)]


def test_the_stage_clear_is_announced_once_and_raises_a_save_request() -> None:
    flow = make_clear_flow()
    flow.stage_number = 1
    enter_stage_clear(flow)
    assert kinds_in_ring(flow).count(EV_STAGE_CLEAR) == 1
    index = kinds_in_ring(flow).index(EV_STAGE_CLEAR)
    assert record(flow, index)[3] == 1.0
    assert flow.save_requested is True
    assert flow.timer == 0
    flow.events.clear()
    for _ in range(STAGE_CLEAR_TICKS - 1):
        flow.step()
    assert flow.events.n == 0
    assert flow.state == FlowState.STAGE_CLEAR


def test_after_the_stage_clear_the_stage_restarts_through_the_intro() -> None:
    restarts: list[int] = []
    flow = make_clear_flow()
    flow.on_stage_restart = lambda: restarts.append(flow.timer)
    enter_stage_clear(flow)
    for _ in range(STAGE_CLEAR_TICKS - 1):
        flow.step()
    assert restarts == []
    flow.step()
    assert restarts == [STAGE_CLEAR_TICKS]
    assert (flow.state, flow.timer) == (FlowState.INTRO, 0)
    assert (flow.boss, flow.boss_destroyed) == (None, False)
    assert flow.tally.amounts == [0, 0, 0, 0]
    assert flow.tally.revealed == 0
    assert flow.spawning is True
    flow.events.clear()
    flow.step()
    assert kinds_in_ring(flow) == [EV_STAGE_START]


def test_the_loop_keeps_the_save_request_for_the_adapter_to_clear() -> None:
    flow = make_clear_flow()
    enter_stage_clear(flow)
    for _ in range(STAGE_CLEAR_TICKS):
        flow.step()
    assert flow.state == FlowState.INTRO
    assert flow.save_requested is True


def test_a_flow_with_no_restart_callback_still_loops_to_the_intro() -> None:
    flow = make_clear_flow()
    enter_stage_clear(flow)
    for _ in range(STAGE_CLEAR_TICKS):
        flow.step()
    assert flow.state == FlowState.INTRO


def test_game_over_during_the_stage_clear_wins_and_the_stage_does_not_restart() -> None:
    restarts: list[int] = []
    flow = make_clear_flow()
    flow.on_stage_restart = lambda: restarts.append(1)
    enter_stage_clear(flow)
    flow.life.phase = PlayerPhase.OUT
    flow.step()
    assert flow.state == FlowState.GAME_OVER
    for _ in range(STAGE_CLEAR_TICKS + 5):
        flow.step()
    assert restarts == []
    assert flow.state == FlowState.GAME_OVER


def test_the_next_loops_tally_counts_only_its_own_medals_and_deaths() -> None:
    flow = make_clear_flow(medals=5, deaths=2)
    flow.life.deaths = 2  # two ships lost in this loop's stage (counted from 0)
    enter_stage_clear(flow)
    assert flow.tally.amounts[2] == 0
    for _ in range(STAGE_CLEAR_TICKS + 1):
        flow.step()  # the loop's first INTRO step re-bases both counters
    assert flow.state == FlowState.INTRO
    assert flow.chain.collected == 0
    flow.chain.collected = 3
    flow.state = FlowState.CLEAR
    flow.boss_destroyed = True
    flow.timer = 0
    enter_tally(flow)
    assert flow.tally.amounts == [100_000, 3_000, 50_000, 0]
    flow.life.deaths = 3
    flow.reset()
    flow.step()
    flow.life.deaths = 4
    flow.state = FlowState.CLEAR
    flow.timer = 0
    enter_tally(flow)
    assert flow.tally.amounts[2] == 0


def test_equal_amounts_still_reveal_in_the_fixed_order() -> None:
    flow = make_clear_flow(destroyed=False, medals=0, bombs=0)
    flow.life.deaths = 1
    enter_tally(flow)
    order = []
    for _ in range(3 * TALLY_LINE_TICKS + 1):
        flow.step()
        order += [index for index, _ in tally_lines(flow)]
        flow.events.clear()
    assert order == [0, 1, 2, 3]
