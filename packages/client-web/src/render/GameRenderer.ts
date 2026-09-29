import * as THREE from 'three';
import type { LevelMetadata } from '@dtr/shared-level';
import {
  colorById,
  type BarrelSnapshot,
  type BossSnapshot,
  type ItemBoxSnapshot,
  type PlayerColorId,
  type PlayerSnapshot,
} from '@dtr/shared-protocol';
import { BARREL_HALF_LENGTH, BARREL_RADIUS } from '@dtr/shared-simulation';
import {
  barrelTexture,
  brickTexture,
  deckTexture,
  girderTexture,
  hazardTexture,
  itemBoxTexture,
  labelTexture,
  skyTexture,
  speechBubbleTexture,
  starTexture,
} from './textures.js';

const DECK_THICKNESS = 0.35;
const CHARACTER_HEIGHT = 1.8;
const BOSS_HEIGHT = 4.2;
const CAMERA_BACK = 5.6;
const CAMERA_UP = 2.3;
const CAMERA_LOOK_AHEAD = 5;

export interface RenderPlayer extends PlayerSnapshot {
  isLocal: boolean;
}

export interface RenderFrame {
  players: RenderPlayer[];
  barrels: BarrelSnapshot[];
  itemBoxes: ItemBoxSnapshot[];
  boss: BossSnapshot | null;
  /** Player the camera follows (usually the local player). */
  focus: { x: number; y: number; z: number; floorY: number; climbing: boolean } | null;
  cameraDirection: 1 | -1;
  serverTimeMs: number;
  dtSeconds: number;
}

interface PlayerVisual {
  group: THREE.Group;
  sprite: THREE.Sprite;
  ring: THREE.Mesh;
  label: THREE.Sprite;
  stars: THREE.Group;
  shield: THREE.Mesh;
  front: THREE.SpriteMaterial;
  back: THREE.SpriteMaterial;
  labelKey: string;
}

/**
 * Three.js presentation of a match. Purely visual: it renders whatever state it is
 * handed each frame and never decides gameplay outcomes.
 */
export class GameRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
  private readonly loader = new THREE.TextureLoader();
  private readonly players = new Map<string, PlayerVisual>();
  private readonly barrels = new Map<number, THREE.Mesh>();
  private readonly itemBoxes = new Map<string, THREE.Mesh>();
  private readonly resizeObserver: ResizeObserver;
  private readonly spriteTextures = new Map<string, THREE.Texture>();
  private readonly barrelGeometry = new THREE.CylinderGeometry(
    BARREL_RADIUS,
    BARREL_RADIUS,
    BARREL_HALF_LENGTH * 2,
    20,
  );
  private readonly barrelMaterial: THREE.MeshStandardMaterial;
  private readonly itemGeometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  private readonly itemMaterial: THREE.MeshStandardMaterial;
  private readonly starMaterial: THREE.SpriteMaterial;
  private boss: THREE.Sprite | null = null;
  private motzfeldt: THREE.Group | null = null;
  private cameraInitialized = false;
  private elapsed = 0;

  constructor(
    private readonly container: HTMLElement,
    private readonly level: LevelMetadata,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-label', 'Race view');
    this.renderer.domElement.setAttribute('role', 'img');
    container.appendChild(this.renderer.domElement);

    this.barrelMaterial = new THREE.MeshStandardMaterial({ map: barrelTexture(), roughness: 0.7 });
    this.itemMaterial = new THREE.MeshStandardMaterial({
      map: itemBoxTexture(),
      emissive: new THREE.Color('#ff9800'),
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.92,
    });
    this.starMaterial = new THREE.SpriteMaterial({ map: starTexture(), depthTest: false });

    this.buildEnvironment();
    this.buildLevel();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const m of materials) m.dispose();
      }
    });
    for (const texture of this.spriteTextures.values()) texture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  render(frame: RenderFrame): void {
    this.elapsed += frame.dtSeconds;
    this.updatePlayers(frame);
    this.updateBarrels(frame.barrels, frame.dtSeconds);
    this.updateItemBoxes(frame.itemBoxes);
    this.updateBoss(frame.boss);
    this.updateMotzfeldt();
    this.updateCamera(frame);
    this.renderer.render(this.scene, this.camera);
  }

  // ---- construction -------------------------------------------------------------------

  private texture(path: string): THREE.Texture {
    let texture = this.spriteTextures.get(path);
    if (!texture) {
      texture = this.loader.load(path);
      texture.colorSpace = THREE.SRGBColorSpace;
      this.spriteTextures.set(path, texture);
    }
    return texture;
  }

  private buildEnvironment(): void {
    this.scene.background = skyTexture();
    this.scene.fog = new THREE.Fog('#27306b', 45, 140);
    this.scene.add(new THREE.HemisphereLight('#dfe8ff', '#3b2a4a', 1.4));
    const sun = new THREE.DirectionalLight('#fff3e0', 1.6);
    sun.position.set(-10, 40, 25);
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({ color: '#1b5e20', roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(20, -28, 0);
    this.scene.add(ground);

    // A distant skyline so the tower reads as high up.
    const skyline = new THREE.MeshStandardMaterial({ color: '#283593', roughness: 1 });
    for (let i = 0; i < 40; i++) {
      const w = 4 + ((i * 7) % 6);
      const h = 10 + ((i * 13) % 30);
      const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), skyline);
      const side = i % 2 === 0 ? -1 : 1;
      building.position.set(-60 + i * 4.5, -28 + h / 2, side * (40 + ((i * 17) % 30)));
      this.scene.add(building);
    }
  }

  private buildLevel(): void {
    const { level } = this;
    const girder = girderTexture();
    const deck = deckTexture();
    const depth = level.bounds.zMax - level.bounds.zMin + 0.6;

    for (const floor of level.floors) {
      const width = floor.endX - floor.startX;
      const side = girder.clone();
      side.repeat.set(width / 4, 1);
      side.needsUpdate = true;
      const top = deck.clone();
      top.repeat.set(width / 2, depth / 2);
      top.needsUpdate = true;
      const sideMat = new THREE.MeshStandardMaterial({ map: side, roughness: 0.6, metalness: 0.2 });
      const topMat = new THREE.MeshStandardMaterial({ map: top, roughness: 0.8 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, DECK_THICKNESS, depth), [
        sideMat,
        sideMat,
        topMat,
        sideMat,
        sideMat,
        sideMat,
      ]);
      mesh.position.set((floor.startX + floor.endX) / 2, floor.y - DECK_THICKNESS / 2, 0);
      mesh.name = `mvp.floor.${floor.id}`;
      this.scene.add(mesh);

      if (floor.endX >= level.bounds.rightFallEdgeX) {
        const stripe = hazardTexture();
        stripe.repeat.set(depth, 1);
        const edge = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, 0.06, depth),
          new THREE.MeshBasicMaterial({ map: stripe }),
        );
        edge.position.set(floor.endX - 0.125, floor.y + 0.03, 0);
        edge.name = `mvp.rightFallEdge.${floor.id}`;
        this.scene.add(edge);
      }
    }

    // Left wall (bricks) spanning the whole tower.
    const topY = Math.max(...level.floors.map((f) => f.y)) + 4;
    const bricks = brickTexture();
    bricks.repeat.set(3, topY / 2);
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, topY + 2, depth + 0.4),
      new THREE.MeshStandardMaterial({ map: bricks, roughness: 0.9 }),
    );
    wall.position.set(level.bounds.leftWallX - 0.3, topY / 2 - 1, 0);
    wall.name = 'mvp.leftWall';
    this.scene.add(wall);

    // Decorative back supports.
    const beam = new THREE.MeshStandardMaterial({
      color: '#00838f',
      roughness: 0.5,
      metalness: 0.4,
    });
    for (let x = 8; x < level.bounds.rightFallEdgeX; x += 8) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.3, topY - 4, 0.3), beam);
      pillar.position.set(x, (topY - 4) / 2 - 0.2, level.bounds.zMin - 0.45);
      this.scene.add(pillar);
    }

    // Ladders.
    const ladderMat = new THREE.MeshStandardMaterial({
      color: '#26c6da',
      emissive: '#006064',
      emissiveIntensity: 0.4,
    });
    for (const ladder of level.ladders) {
      const bottom = level.floors.find((f) => f.id === ladder.bottomFloorId)!;
      const top = level.floors.find((f) => f.id === ladder.topFloorId)!;
      const height = top.y - bottom.y;
      const group = new THREE.Group();
      group.name = `mvp.ladder.${ladder.id}`;
      for (const z of [ladder.zMin, ladder.zMax]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, height + 0.9, 0.14), ladderMat);
        rail.position.set(0, height / 2 + 0.2, z);
        group.add(rail);
      }
      for (let y = 0.4; y < height + 0.4; y += 0.5) {
        const rung = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.1, ladder.zMax - ladder.zMin),
          ladderMat,
        );
        rung.position.set(0, y, (ladder.zMin + ladder.zMax) / 2);
        group.add(rung);
      }
      group.position.set(ladder.x, bottom.y, 0);
      this.scene.add(group);
    }

    // Oil drum where barrels end their journey.
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 1.4, 20),
      new THREE.MeshStandardMaterial({ color: '#1565c0', metalness: 0.5, roughness: 0.4 }),
    );
    drum.position.set(level.barrelSinkX - 0.2, 0.7, level.bounds.zMin + 0.2);
    this.scene.add(drum);

    // Boss and a stack of spare barrels.
    const bossFloor = level.floors.find((f) => f.id === level.bossSpawn.floorId)!;
    const bossSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.texture('/sprites/trump-front.png') }),
    );
    bossSprite.center.set(0.5, 0);
    bossSprite.position.set(level.bossSpawn.x, bossFloor.y, level.bossSpawn.z);
    bossSprite.name = 'boss.trump';
    this.boss = bossSprite;
    this.scene.add(bossSprite);
    for (let i = 0; i < 3; i++) {
      const spare = new THREE.Mesh(this.barrelGeometry, this.barrelMaterial);
      spare.rotation.x = Math.PI / 2;
      spare.rotation.z = Math.PI / 2;
      spare.position.set(
        level.bounds.rightFallEdgeX - 0.6,
        bossFloor.y + 0.5 + i * 1.0,
        level.bounds.zMin + 0.6,
      );
      this.scene.add(spare);
    }

    // Motzfeldt waiting on the rescue platform.
    const rescueFloor = level.floors.find((f) => f.id === level.rescueZone.floorId)!;
    const motz = new THREE.Group();
    motz.name = 'mvp.rescuePoint';
    const motzSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.texture('/sprites/motzfeldt-front.png') }),
    );
    motzSprite.onBeforeRender = () =>
      motzSprite.scale.set(1.9 * aspectOf(motzSprite.material.map), 1.9, 1);
    motzSprite.center.set(0.5, 0);
    motz.add(motzSprite);
    const bubble = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: speechBubbleTexture('HELP!') }),
    );
    bubble.scale.set(1.6, 0.8, 1);
    bubble.position.set(0.3, 2.5, 0);
    motz.add(bubble);
    motz.position.set(rescueFloor.endX - 2.2, rescueFloor.y, 0);
    this.motzfeldt = motz;
    this.scene.add(motz);
  }

  // ---- per-frame updates ------------------------------------------------------------------

  private playerVisual(player: RenderPlayer): PlayerVisual {
    let visual = this.players.get(player.id);
    if (visual) return visual;
    const color = colorById(player.color);
    const front = new THREE.SpriteMaterial({
      map: this.texture(spritePath(player.color, 'front')),
    });
    const back = new THREE.SpriteMaterial({ map: this.texture(spritePath(player.color, 'back')) });
    front.transparent = true;
    back.transparent = true;
    const sprite = new THREE.Sprite(front);
    sprite.center.set(0.5, 0);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.62, 32),
      new THREE.MeshBasicMaterial({
        color: color.hex,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;

    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ depthTest: false, transparent: true }),
    );
    label.center.set(0.5, 0);
    label.position.y = CHARACTER_HEIGHT + 0.15;
    label.renderOrder = 10;

    const stars = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const star = new THREE.Sprite(this.starMaterial);
      star.scale.set(0.32, 0.32, 1);
      star.renderOrder = 11;
      stars.add(star);
    }
    stars.visible = false;

    const shield = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 24, 16),
      new THREE.MeshBasicMaterial({
        color: '#80deea',
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    );
    shield.position.y = 0.9;
    shield.visible = false;

    const group = new THREE.Group();
    group.name = `player.jumpman.${player.slotIndex}`;
    group.add(sprite, ring, label, stars, shield);
    this.scene.add(group);
    visual = { group, sprite, ring, label, stars, shield, front, back, labelKey: '' };
    this.players.set(player.id, visual);
    return visual;
  }

  private updatePlayers(frame: RenderFrame): void {
    const seen = new Set<string>();
    for (const player of frame.players) {
      seen.add(player.id);
      const v = this.playerVisual(player);
      v.group.position.set(player.x, player.y, player.z);
      // The chase camera sits right behind you; your own label would block the view ahead.
      v.label.visible = !player.isLocal;

      const labelKey = `${player.nickname}|${player.isLocal}|${player.finishRank}`;
      if (labelKey !== v.labelKey) {
        const color = colorById(player.color);
        const title = player.isLocal ? `${player.nickname} (you)` : player.nickname;
        const subtitle =
          player.finishRank !== null
            ? `Rescued #${player.finishRank}`
            : `Player ${player.slotIndex + 1} · ${color.label}`;
        const { texture, aspect } = labelTexture(title, color.hex, subtitle);
        const material = v.label.material;
        material.map?.dispose();
        material.map = texture;
        material.needsUpdate = true;
        v.label.scale.set(0.5 * aspect, 0.5, 1);
        v.labelKey = labelKey;
      }

      // Show the back when running away from the camera (Mario Kart view), otherwise the front.
      const away = player.facing === frame.cameraDirection || player.climbing !== null;
      const material = away ? v.back : v.front;
      v.sprite.material = material;
      v.sprite.scale.set(CHARACTER_HEIGHT * aspectOf(material.map), CHARACTER_HEIGHT, 1);
      const disabled = player.movementDisabledUntilMs > frame.serverTimeMs;
      // Knocked down: the sprite lies on its side.
      const knocked = player.knockedDown && disabled;
      material.rotation = knocked ? Math.PI / 2 : 0;
      v.sprite.center.set(0.5, knocked ? 0.3 : 0);
      const blinking = player.fallPenalty && disabled;
      material.opacity = blinking ? (Math.sin(this.elapsed * 20) > 0 ? 0.35 : 0.9) : 1;
      const running = Math.hypot(player.vx, player.vz) > 0.5 && player.grounded;
      v.sprite.position.y = running ? Math.abs(Math.sin(this.elapsed * 14)) * 0.08 : 0;

      v.stars.visible = player.knockedDown && disabled;
      if (v.stars.visible) {
        v.stars.children.forEach((star, i) => {
          const a = this.elapsed * 4 + (i / v.stars.children.length) * Math.PI * 2;
          star.position.set(Math.cos(a) * 0.55, 1.0 + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.55);
        });
      }
      v.shield.visible = player.shieldUntilMs > frame.serverTimeMs;
      const boosted = player.speedBoostUntilMs > frame.serverTimeMs;
      v.ring.scale.setScalar(boosted ? 1.2 + Math.sin(this.elapsed * 18) * 0.15 : 1);
      v.ring.visible = player.grounded;
    }
    for (const [id, v] of this.players) {
      if (seen.has(id)) continue;
      this.scene.remove(v.group);
      this.players.delete(id);
    }
  }

  private updateBarrels(barrels: BarrelSnapshot[], dt: number): void {
    const seen = new Set<number>();
    for (const b of barrels) {
      seen.add(b.id);
      let mesh = this.barrels.get(b.id);
      if (!mesh) {
        mesh = new THREE.Mesh(this.barrelGeometry, this.barrelMaterial);
        mesh.rotation.order = 'ZXY';
        mesh.rotation.x = Math.PI / 2;
        mesh.name = `hazard.barrel.${b.id}`;
        this.barrels.set(b.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(b.x, b.y + BARREL_RADIUS, b.z);
      mesh.rotation.z -= (b.vx / BARREL_RADIUS) * dt;
    }
    for (const [id, mesh] of this.barrels) {
      if (seen.has(id)) continue;
      this.scene.remove(mesh);
      this.barrels.delete(id);
    }
  }

  private updateItemBoxes(boxes: ItemBoxSnapshot[]): void {
    for (const box of boxes) {
      let mesh = this.itemBoxes.get(box.id);
      if (!mesh) {
        mesh = new THREE.Mesh(this.itemGeometry, this.itemMaterial);
        mesh.name = `item.pickup.${box.id}`;
        this.itemBoxes.set(box.id, mesh);
        this.scene.add(mesh);
      }
      mesh.visible = box.active;
      mesh.position.set(box.x, box.y + 1 + Math.sin(this.elapsed * 3 + box.x) * 0.12, box.z);
      mesh.rotation.y = this.elapsed * 1.5;
      mesh.rotation.x = 0.4;
    }
  }

  private updateBoss(boss: BossSnapshot | null): void {
    if (!this.boss) return;
    const throwing = boss?.throwing ?? false;
    const squash = throwing
      ? 1 + Math.sin(this.elapsed * 30) * 0.05
      : 1 + Math.sin(this.elapsed * 2) * 0.02;
    const height = BOSS_HEIGHT;
    this.boss.scale.set(
      height * aspectOf(this.boss.material.map) * (2 - squash),
      height * squash,
      1,
    );
    // Flushes red with anger while winding up a throw.
    this.boss.material.color.set(throwing ? '#ffb4a8' : '#ffffff');
  }

  private updateMotzfeldt(): void {
    if (!this.motzfeldt) return;
    const bubble = this.motzfeldt.children[1];
    if (bubble) bubble.position.y = 2.5 + Math.sin(this.elapsed * 3) * 0.1;
  }

  private updateCamera(frame: RenderFrame): void {
    const dir = frame.cameraDirection;
    let target: THREE.Vector3;
    if (frame.focus) {
      // Follow the floor height rather than every jump so the camera stays under the next deck.
      const baseY = frame.focus.climbing ? frame.focus.y : frame.focus.floorY;
      target = new THREE.Vector3(frame.focus.x, baseY, frame.focus.z * 0.6);
    } else {
      target = new THREE.Vector3(20, 8, 0);
    }
    const desired = new THREE.Vector3(target.x - dir * CAMERA_BACK, target.y + CAMERA_UP, target.z);
    const look = new THREE.Vector3(
      target.x + dir * CAMERA_LOOK_AHEAD,
      target.y + 0.9,
      target.z * 0.5,
    );
    // Never let the chase camera slip behind the left wall.
    desired.x = Math.max(this.level.bounds.leftWallX + 0.8, desired.x);
    if (!frame.focus) {
      desired.set(20, 12, 34);
      look.set(20, 9, 0);
    }
    if (!this.cameraInitialized) {
      this.camera.position.copy(desired);
      this.cameraInitialized = true;
    } else {
      const t = 1 - Math.exp(-6 * frame.dtSeconds);
      this.camera.position.lerp(desired, t);
    }
    this.camera.lookAt(look);
  }

  private resize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}

/** Width/height of a loaded texture image (falls back while loading). */
function aspectOf(texture: THREE.Texture | null): number {
  const image = texture?.image as { width?: number; height?: number } | undefined;
  return image?.width && image.height ? image.width / image.height : 0.75;
}

export function spritePath(color: PlayerColorId, view: 'front' | 'back'): string {
  return `/sprites/lokke-${color}-${view}.png`;
}
