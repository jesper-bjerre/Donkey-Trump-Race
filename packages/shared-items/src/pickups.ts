import { MVP_VERTICAL_MAP, type LevelMetadata } from '@dtr/shared-level';

export interface ItemPickupVolume {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
}

export function getItemPickupVolumes(level: LevelMetadata): ItemPickupVolume[] {
  return level.itemBoxes.map((box) => {
    const floor = level.floors.find((f) => f.id === box.floorId);
    return {
      id: box.id,
      x: box.x,
      y: (floor?.y ?? 0) + 1,
      z: box.z,
      width: 1.6,
      height: 1.6,
      depth: 1.6,
    };
  });
}

/** Deterministic pickup volumes for the single MVP map. */
export const MVP_ITEM_PICKUP_VOLUMES: readonly ItemPickupVolume[] = Object.freeze(
  getItemPickupVolumes(MVP_VERTICAL_MAP),
);

/**
 * Whether a player (feet position, cylinder of `playerRadius`) touches a pickup volume.
 * Horizontal reach is the box half-width plus the player radius; vertically the player's
 * feet must be within the box's height band around its centre.
 */
export function intersectsPickupVolume(
  volume: ItemPickupVolume,
  position: { x: number; y: number; z: number },
  playerRadius: number,
): boolean {
  const reach = volume.width / 2 + playerRadius;
  const halfHeight = volume.height / 2 + 0.7;
  return (
    Math.hypot(position.x - volume.x, position.z - volume.z) < reach &&
    position.y >= volume.y - halfHeight &&
    position.y < volume.y + halfHeight
  );
}
