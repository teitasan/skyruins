import { MathUtils } from 'three';

// Render between fixed physics ticks. Physics/collision always use the current x/y.
export function rememberPosition(entity) {
  entity.renderPrevX = entity.x;
  entity.renderPrevY = entity.y;
}

export function samplePosition(entity, alpha = 1) {
  const x = entity.renderPrevX ?? entity.x;
  const y = entity.renderPrevY ?? entity.y;
  // Respawn/teleport must snap instead of sweeping through the level.
  if (Math.abs(entity.x - x) > 64 || Math.abs(entity.y - y) > 64) return {x:entity.x, y:entity.y};
  const t = MathUtils.clamp(alpha, 0, 1);
  return {x:MathUtils.lerp(x, entity.x, t), y:MathUtils.lerp(y, entity.y, t)};
}
