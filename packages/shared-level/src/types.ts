export type Direction = 1 | -1;

export interface FloorSegment {
  id: string;
  index: number;
  /** Walking surface height. */
  y: number;
  startX: number;
  endX: number;
  /** Direction players must run on this floor to reach the next ladder. */
  runDirection: Direction;
  /** Direction barrels roll on this floor (0 = no barrels). */
  barrelDirection: Direction | 0;
  /** Safe respawn point after a fall from this floor. */
  spawn: { x: number; z: number };
}

export interface LadderVolume {
  id: string;
  x: number;
  width: number;
  zMin: number;
  zMax: number;
  bottomFloorId: string;
  topFloorId: string;
}

export interface RescueZone {
  id: string;
  floorId: string;
  minX: number;
  maxX: number;
}

export interface BossSpawn {
  floorId: string;
  x: number;
  z: number;
}

export interface PlayerSpawn {
  floorId: string;
  x: number;
  z: number;
}

export interface PlayableBounds {
  leftWallX: number;
  rightFallEdgeX: number;
  zMin: number;
  zMax: number;
}

export interface ItemBoxPlacement {
  id: string;
  floorId: string;
  x: number;
  z: number;
}

export interface LevelMetadata {
  id: string;
  name: string;
  floors: FloorSegment[];
  ladders: LadderVolume[];
  rescueZone: RescueZone;
  bossSpawn: BossSpawn;
  playerSpawns: PlayerSpawn[];
  bounds: PlayableBounds;
  itemBoxes: ItemBoxPlacement[];
  /** Barrels reaching this end of the bottom floor are destroyed (oil drum). */
  barrelSinkX: number;
}
