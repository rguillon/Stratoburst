"""Bullet pattern helpers: volleys written straight into a ``BulletPool``.

``fire_aimed``, ``fire_ring`` and ``fire_spread`` are the shapes; ``run_pattern`` is the one runner
that plays any ``PatternSpec`` (ENMY-04). Each helper spawns what fits and returns how many bullets
it spawned, so callers never need to know the pool's fill level.
"""

import math

from scorched_core.patterns.fire_pattern import FirePattern
from scorched_core.patterns.pattern_spec import PatternSpec
from scorched_core.pools.bullet_pool import BulletPool


def fire_aimed(  # noqa: PLR0913, PLR0917 - a shot is a pool, a muzzle, a target and a speed
    pool: BulletPool, x: float, y: float, target_x: float, target_y: float, speed: float
) -> int:
    """Spawn one bullet from ``(x, y)`` flying at ``speed`` units per step towards the target.

    A target on the muzzle has no direction, so the bullet flies straight down the screen.
    Returns 1, or 0 when the pool is full.
    """
    dx = target_x - x
    dy = target_y - y
    distance = math.hypot(dx, dy)
    if distance == 0.0:
        return int(pool.spawn(x, y, 0.0, speed))
    scale = speed / distance
    return int(pool.spawn(x, y, dx * scale, dy * scale))


def fire_ring(  # noqa: PLR0913, PLR0917 - a ring is a pool, a centre, a count, a speed and a phase
    pool: BulletPool, x: float, y: float, count: int, speed: float, phase: float
) -> int:
    """Spawn ``count`` bullets from ``(x, y)`` evenly spaced in angle, the first at ``phase``.

    Angles follow the bullet-pool convention: 0 flies straight up the screen and positive angles
    turn clockwise (to the right). Returns how many bullets fit; a full pool spawns none.
    """
    step = math.tau / count
    spawned = 0
    for k in range(count):
        angle = phase + k * step
        if not pool.spawn(x, y, speed * math.sin(angle), -speed * math.cos(angle)):
            break
        spawned += 1
    return spawned


def fire_spread(  # noqa: PLR0913, PLR0917 - a fan is a pool, a muzzle, an aim, a count, an arc and a speed
    pool: BulletPool,
    x: float,
    y: float,
    aim_angle: float,
    count: int,
    arc_deg: float,
    speed: float,
) -> int:
    """Spawn ``count`` bullets from ``(x, y)`` fanned evenly over ``arc_deg`` around ``aim_angle``.

    Angles follow the bullet-pool convention (0 flies up, positive turns clockwise). One bullet
    flies straight along ``aim_angle``. Returns how many bullets fit; a full pool spawns none.
    """
    first = aim_angle - math.radians(arc_deg) / 2.0 if count > 1 else aim_angle
    step = math.radians(arc_deg) / (count - 1) if count > 1 else 0.0
    spawned = 0
    for k in range(count):
        angle = first + k * step
        if not pool.spawn(x, y, speed * math.sin(angle), -speed * math.cos(angle)):
            break
        spawned += 1
    return spawned


def run_pattern(  # noqa: PLR0913, PLR0917 - a volley is a spec, a pool, a muzzle, a target and a count
    spec: PatternSpec,
    pool: BulletPool,
    x: float,
    y: float,
    target_x: float,
    target_y: float,
    volley: int,
) -> int:
    """Play one volley of ``spec`` from ``(x, y)`` at the target; return how many bullets spawned.

    ``volley`` counts this enemy's volleys so far and rotates a ring by ``phase_step_deg`` each
    time (wrapped to one ring step). A target on the muzzle has no direction, so it is aimed
    straight down the screen.
    """
    match spec.shape:
        case FirePattern.AIMED | FirePattern.STREAM:
            if spec.aim_offset_deg == 0.0:
                return fire_aimed(pool, x, y, target_x, target_y, spec.speed)
            aim = _aim_angle(x, y, target_x, target_y) + math.radians(spec.aim_offset_deg)
            return fire_spread(pool, x, y, aim, 1, 0.0, spec.speed)
        case FirePattern.SPREAD:
            aim = _aim_angle(x, y, target_x, target_y) + math.radians(spec.aim_offset_deg)
            return fire_spread(pool, x, y, aim, spec.count, spec.arc_deg, spec.speed)
        case FirePattern.RING:
            phase = math.radians((volley * spec.phase_step_deg) % (360.0 / spec.count))
            return fire_ring(pool, x, y, spec.count, spec.speed, phase)
        case unknown:
            msg = f"unknown pattern shape {unknown}"
            raise ValueError(msg)


def _aim_angle(x: float, y: float, target_x: float, target_y: float) -> float:
    """Return the bullet-pool angle from the muzzle to the target (straight down when on it)."""
    dx = target_x - x
    dy = target_y - y
    if dx == 0.0 and dy == 0.0:
        return math.pi
    return math.atan2(dx, -dy)
