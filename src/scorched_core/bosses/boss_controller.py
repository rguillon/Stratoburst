"""The boss controller (ENMY-06, ENMY-07, ENMY-09): scripted rows plus a spec-driven fight.

A boss is ordinary ``EnemyPool`` rows (RESEARCH Pattern 4), so every weapon already damages
them. The controller moves its SCRIPTED rows, owns the fight state and turns a destroyed part
into a stump. The game calls ``step`` before ``EnemyPool.step`` and ``settle`` after every
damage pass and before ``remove_dead``. Rows are always found by uid with ``index_of_uid``,
never by slot: a swap-remove moves slots.
"""

from array import array
from dataclasses import dataclass, field

from scorched_core.bosses.boss_spec import BossSpec
from scorched_core.bosses.boss_state import BossState
from scorched_core.clock.hitstop import Hitstop
from scorched_core.entities.motion_kind import MotionKind
from scorched_core.events.event_ring import EventRing
from scorched_core.pools.bullet_pool import BulletPool
from scorched_core.pools.enemy_pool import EnemyPool
from scorched_core.protocol import BLAST_MEDIUM, EV_EXPLOSION, EV_PART_DESTROYED
from scorched_core.tuning import ENEMY_GROUND, ENEMY_MAX_ALIVE, HITSTOP_PART_TICKS

_VULNERABLE: int = 0  # the shield value of a row that takes damage
_PERMANENT: int = -1  # the shield value that never counts down


@dataclass(slots=True)
class BossController:
    """One boss fight: ``spec`` is the data and ``slot`` the boss slot (1 mid-boss, 2 boss).

    ``hull_uid`` and the per-part uids name the rows. The per-part arrays are allocated once at
    construction, so stepping allocates nothing. ``fight_ticks`` counts the simulation steps since
    the entrance ended.
    """

    spec: BossSpec
    slot: int
    state: BossState = field(default=BossState.ENTER, init=False)
    hull_uid: int = field(default=0, init=False)
    fight_ticks: int = field(default=0, init=False)
    _part_uids: array = field(init=False, repr=False)
    _part_alive: bytearray = field(init=False, repr=False)
    _x: float = field(default=0.0, init=False, repr=False)
    _y: float = field(default=0.0, init=False, repr=False)
    _hp_fraction: float = field(default=1.0, init=False, repr=False)
    _started: bool = field(default=False, init=False, repr=False)

    def __post_init__(self) -> None:
        count = len(self.spec.parts)
        self._part_uids = array("i", bytes(4 * count))
        self._part_alive = bytearray(count)

    @property
    def active(self) -> bool:
        """Return whether the boss is on the field: started and not yet gone."""
        return self._started and self.state is not BossState.GONE

    @property
    def gone(self) -> bool:
        """Return whether the fight is over and every row is removed."""
        return self.state is BossState.GONE

    @property
    def hp_fraction(self) -> float:
        """Return the hull's health as of the last settle, 1.0 down to 0.0."""
        return self._hp_fraction

    def part_uid(self, k: int) -> int:
        """Return the uid of part ``k``'s row (a part keeps its row as a stump)."""
        return int(self._part_uids[k])

    def start(self, enemies: EnemyPool) -> bool:
        """Spawn the shielded hull and parts above the screen; False (nothing spawned) if no room.

        Rows spawn SCRIPTED at the spec offsets from ``(x, enter_y)``, shielded for good until the
        entrance ends. The pool must have room for the whole boss: a half-spawned boss is refused.
        """
        spec = self.spec
        parts = spec.parts
        if enemies.n + 1 + len(parts) > ENEMY_MAX_ALIVE:
            return False
        enemies.spawn(
            spec.hull_kind,
            spec.x,
            spec.enter_y,
            MotionKind.SCRIPTED,
            0.0,
            0.0,
            hp=spec.hull_hp,
            radius=spec.hull_radius,
            shield=_PERMANENT,
        )
        self.hull_uid = int(enemies.uid[enemies.n - 1])
        for k in range(len(parts)):
            part = parts[k]
            enemies.spawn(
                part.kind,
                spec.x + part.dx,
                spec.enter_y + part.dy,
                MotionKind.SCRIPTED,
                0.0,
                0.0,
                hp=part.hp,
                radius=part.effective_radius,
                shield=_PERMANENT,
            )
            self._part_uids[k] = enemies.uid[enemies.n - 1]
            self._part_alive[k] = 1
        self.state = BossState.ENTER
        self.fight_ticks = 0
        self._x = spec.x
        self._y = spec.enter_y
        self._hp_fraction = 1.0
        self._started = True
        return True

    def step(
        self,
        enemies: EnemyPool,
        ebullets: BulletPool,  # noqa: ARG002 - the emitters arrive with the phases
        ship_x: float,  # noqa: ARG002
        ship_y: float,  # noqa: ARG002
        events: EventRing,  # noqa: ARG002
    ) -> None:
        """Advance the fight one simulation step: the entrance descent, then the held position."""
        if not self.active:
            return
        if self.state is BossState.ENTER:
            self._enter(enemies)
        else:
            self.fight_ticks += 1
            self._place(enemies)

    def settle(
        self,
        enemies: EnemyPool,
        ebullets: BulletPool,  # noqa: ARG002 - phase changes clear it
        events: EventRing,
        hitstop: Hitstop,
    ) -> int:
        """Convert destroyed parts into stumps after the damage passes; return the points to pay.

        This runs before ``remove_dead``, so a part at zero hp becomes a stump (1 hp, a permanent
        shield) instead of being removed. Each destroyed part pushes an EXPLOSION and a
        PART_DESTROYED event and asks for ``HITSTOP_PART_TICKS`` of hitstop.
        """
        if self.state is not BossState.FIGHT:
            return 0
        points = 0
        parts = self.spec.parts
        for k in range(len(parts)):
            if not self._part_alive[k]:
                continue
            i = enemies.index_of_uid(int(self._part_uids[k]))
            if i < 0:
                self._part_alive[k] = 0  # the row left the pool: it can never count again
            elif enemies.hp[i] <= 0:
                points += self._destroy_part(k, i, enemies, events, hitstop)
        h = enemies.index_of_uid(self.hull_uid)
        if h >= 0:
            self._hp_fraction = max(int(enemies.hp[h]), 0) / self.spec.hull_hp
        return points

    def _destroy_part(
        self, k: int, i: int, enemies: EnemyPool, events: EventRing, hitstop: Hitstop
    ) -> int:
        """Turn part ``k`` (row ``i``) into its stump, announce it and return its points."""
        part = self.spec.parts[k]
        enemies.become_stump(i, part.stump_kind)
        self._part_alive[k] = 0
        x, y = float(enemies.x[i]), float(enemies.y[i])
        events.push(EV_EXPLOSION, x, y, BLAST_MEDIUM, ENEMY_GROUND[part.kind], part.stump_kind)
        events.push(EV_PART_DESTROYED, x, y, part.points, k, self.slot)
        hitstop.trigger(HITSTOP_PART_TICKS)
        return part.points

    def _enter(self, enemies: EnemyPool) -> None:
        """Descend to the hold line; on arrival open the shields and start the fight."""
        spec = self.spec
        self._y = min(self._y + spec.enter_speed, spec.hold_y)
        self._place(enemies)
        if self._y >= spec.hold_y:
            self.state = BossState.FIGHT
            self._set_shield(enemies, self.hull_uid, _VULNERABLE)
            for k in range(len(spec.parts)):
                self._set_shield(enemies, int(self._part_uids[k]), _VULNERABLE)

    def _place(self, enemies: EnemyPool) -> None:
        """Write the hull's position and every part's offset position into their rows."""
        parts = self.spec.parts
        self._move(enemies, self.hull_uid, self._x, self._y)
        for k in range(len(parts)):
            part = parts[k]
            self._move(enemies, int(self._part_uids[k]), self._x + part.dx, self._y + part.dy)

    @staticmethod
    def _move(enemies: EnemyPool, uid: int, x: float, y: float) -> None:
        i = enemies.index_of_uid(uid)
        if i >= 0:
            enemies.x[i] = x
            enemies.y[i] = y

    @staticmethod
    def _set_shield(enemies: EnemyPool, uid: int, shield: int) -> None:
        i = enemies.index_of_uid(uid)
        if i >= 0:
            enemies.shield[i] = shield
