"""Where a stage run is in its flow: intro, play, bosses, tally and game over."""

from enum import IntEnum


class FlowState(IntEnum):
    """Flow states. Values never change: they cross the boundary as the FLOW header slot.

    The state machine that moves between them is ``StageFlow``.
    """

    INTRO = 0
    PLAY = 1
    MIDBOSS = 2
    WARNING = 3
    BOSS = 4
    CLEAR = 5
    TALLY = 6
    STAGE_CLEAR = 7
    GAME_OVER = 8
