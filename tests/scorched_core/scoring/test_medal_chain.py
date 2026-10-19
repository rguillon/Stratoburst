from scorched_core.scoring.medal_chain import MedalChain
from scorched_core.tuning import MEDAL_LADDER


def test_the_ladder_climbs_from_one_hundred_to_a_ten_thousand_cap() -> None:
    assert MEDAL_LADDER == (100, 200, 500, 1000, 2000, 5000, 10000)


def test_a_new_chain_offers_the_base_value_and_has_caught_nothing() -> None:
    chain = MedalChain()
    assert (chain.value, chain.index, chain.chain, chain.collected) == (100, 0, 0, 0)


def test_each_catch_pays_the_current_value_and_climbs_the_ladder() -> None:
    chain = MedalChain()
    assert [chain.collect() for _ in range(7)] == list(MEDAL_LADDER)
    assert chain.chain == 7
    assert chain.collected == 7


def test_the_value_stays_at_the_cap_after_the_ladder_runs_out() -> None:
    chain = MedalChain()
    for _ in range(7):
        chain.collect()
    assert chain.value == 10000
    assert [chain.collect() for _ in range(3)] == [10000, 10000, 10000]
    assert chain.index == len(MEDAL_LADDER) - 1


def test_the_next_value_is_shown_after_each_catch() -> None:
    chain = MedalChain()
    chain.collect()
    assert chain.value == 200


def test_a_miss_restarts_the_ladder_and_the_chain_but_keeps_the_stage_count() -> None:
    chain = MedalChain()
    for _ in range(4):
        chain.collect()
    chain.miss()
    assert (chain.value, chain.index, chain.chain) == (100, 0, 0)
    assert chain.collected == 4
    assert chain.collect() == 100


def test_a_stage_reset_zeroes_only_the_stage_count() -> None:
    chain = MedalChain()
    for _ in range(3):
        chain.collect()
    chain.stage_reset()
    assert chain.collected == 0
    assert (chain.value, chain.chain) == (1000, 3)
