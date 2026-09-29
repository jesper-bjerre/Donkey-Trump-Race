import * as THREE from 'three';

/** Image-space point: u from the left edge, v from the top edge (both 0..1). */
type Point = readonly [number, number];

interface PartSpec {
  name: 'body' | 'armL' | 'armR' | 'legL' | 'legR';
  /** Joint the part rotates around (shoulder, hip, …) in image space. */
  pivot: Point;
  /** Image regions owned by the part. The body owns whatever no limb claims. */
  regions: Point[][];
  /** Draw offset toward the camera: arms in front of the jacket, legs tucked behind its hem. */
  depth: number;
}

/*
 * Regions measured from the Løkke turnaround sprites (front and back share the layout):
 * shoulders at v≈0.34, hands hang to v≈0.78 at the outer edges, the jacket hem ends at
 * v≈0.78 and the trouser legs split at u≈0.5.
 */
const HIP_V = 0.74;
const LEG_TOP_V = 0.775;
const PARTS: PartSpec[] = [
  {
    name: 'legL',
    pivot: [0.33, HIP_V],
    regions: [
      [
        [0.16, LEG_TOP_V],
        [0.5, LEG_TOP_V],
        [0.5, 1],
        [0.06, 1],
        [0.06, 0.82],
        [0.16, 0.82],
      ],
    ],
    depth: -0.02,
  },
  {
    name: 'legR',
    pivot: [0.67, HIP_V],
    regions: [
      [
        [0.5, LEG_TOP_V],
        [0.85, LEG_TOP_V],
        [0.85, 0.82],
        [0.96, 0.82],
        [0.96, 1],
        [0.5, 1],
      ],
    ],
    depth: -0.02,
  },
  {
    name: 'armL',
    pivot: [0.2, 0.37],
    regions: [
      [
        [0, 0.3],
        [0.25, 0.3],
        [0.24, 0.36],
        [0.19, 0.56],
        [0.175, 0.73],
        [0.16, 0.82],
        [0, 0.82],
      ],
    ],
    depth: 0.02,
  },
  {
    name: 'armR',
    pivot: [0.8, 0.37],
    regions: [
      [
        [1, 0.3],
        [0.75, 0.3],
        [0.76, 0.36],
        [0.815, 0.56],
        [0.845, 0.73],
        [0.85, 0.82],
        [1, 0.82],
      ],
    ],
    depth: 0.02,
  },
  { name: 'body', pivot: [0.5, HIP_V], regions: [], depth: 0 },
];

const MASK_SIZE = 256;

/** One alpha mask per part; together they cover the sprite exactly once. */
function buildMasks(): Map<PartSpec['name'], THREE.Texture> {
  const masks = new Map<PartSpec['name'], THREE.Texture>();
  const draw = (paint: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas');
    canvas.width = MASK_SIZE;
    canvas.height = MASK_SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
    paint(ctx);
    return new THREE.CanvasTexture(canvas);
  };
  const fill = (ctx: CanvasRenderingContext2D, regions: Point[][], color: string) => {
    ctx.fillStyle = color;
    for (const region of regions) {
      ctx.beginPath();
      region.forEach(([u, v], i) => {
        if (i === 0) ctx.moveTo(u * MASK_SIZE, v * MASK_SIZE);
        else ctx.lineTo(u * MASK_SIZE, v * MASK_SIZE);
      });
      ctx.closePath();
      ctx.fill();
    }
  };
  const limbs = PARTS.filter((p) => p.name !== 'body');
  for (const part of limbs)
    masks.set(
      part.name,
      draw((ctx) => fill(ctx, part.regions, '#fff')),
    );
  masks.set(
    'body',
    draw((ctx) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
      for (const limb of limbs) fill(ctx, limb.regions, '#000');
    }),
  );
  return masks;
}

let sharedMasks: Map<PartSpec['name'], THREE.Texture> | null = null;
const planeGeometry = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);

interface Part {
  spec: PartSpec;
  hinge: THREE.Object3D;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** Hinge position relative to its parent hinge, in image units. */
  offset: Point;
}

export interface RigState {
  x: number;
  y: number;
  z: number;
  grounded: boolean;
  climbing: boolean;
  knockedDown: boolean;
}

/**
 * Jumpman Løkke as a camera-facing cut-out puppet: the flat sprite is split into body,
 * arms and legs that swing around shoulder and hip joints, so he walks, waddles, jumps
 * and climbs hand over hand instead of sliding around as a still picture.
 */
export class LokkeRig {
  /** Billboard: copies the camera orientation every frame. */
  readonly root = new THREE.Group();
  private readonly pose = new THREE.Group();
  private readonly parts = new Map<PartSpec['name'], Part>();
  private map: THREE.Texture | null = null;
  private phase = 0;
  private speed = 0;
  private last: { x: number; y: number; z: number } | null = null;
  private width = 0;

  constructor(private readonly height: number) {
    sharedMasks ??= buildMasks();
    this.root.add(this.pose);
    this.root.name = 'player.rig';
    const body = this.createPart(
      PARTS.find((p) => p.name === 'body')!,
      null,
    );
    for (const spec of PARTS) {
      if (spec.name === 'body') continue;
      // Arms hang from the body so they follow its sway; legs stand on their own.
      this.createPart(spec, spec.name.startsWith('arm') ? body : null);
    }
  }

  get materials(): THREE.MeshBasicMaterial[] {
    return [...this.parts.values()].map((p) => p.mesh.material);
  }

  setTexture(map: THREE.Texture, aspect: number): void {
    if (map !== this.map) {
      for (const part of this.parts.values()) {
        part.mesh.material.map = map;
        part.mesh.material.needsUpdate = true;
      }
      this.map = map;
    }
    const width = this.height * aspect;
    if (width !== this.width) {
      this.width = width;
      this.layout();
    }
  }

  setOpacity(opacity: number): void {
    for (const part of this.parts.values()) part.mesh.material.opacity = opacity;
  }

  update(state: RigState, dt: number, camera: THREE.Camera, animate: boolean): void {
    this.root.quaternion.copy(camera.quaternion);

    // Speed from the rendered motion itself, so it matches what the viewer sees for
    // local (predicted) and remote (interpolated) players alike.
    if (this.last && dt > 0) {
      const d = state.climbing
        ? Math.abs(state.y - this.last.y)
        : Math.hypot(state.x - this.last.x, state.z - this.last.z);
      const measured = Math.min(12, d / dt);
      this.speed += (measured - this.speed) * Math.min(1, dt * 12);
    }
    this.last = { x: state.x, y: state.y, z: state.z };

    const h = this.height;
    const part = (name: PartSpec['name']) => this.parts.get(name)!;
    const armL = part('armL');
    const armR = part('armR');
    const legL = part('legL');
    const legR = part('legR');
    const body = part('body');
    for (const p of this.parts.values()) {
      p.hinge.rotation.z = 0;
      p.hinge.scale.set(1, 1, 1);
      p.hinge.position.set(p.offset[0] * this.width, p.offset[1] * h, p.spec.depth);
    }
    this.pose.rotation.z = 0;
    this.pose.position.set(0, 0, 0);

    if (state.knockedDown) {
      // Flat on his back beside where he stood.
      this.pose.rotation.z = Math.PI / 2;
      this.pose.position.set(h * 0.5, this.width * 0.4, 0);
      armL.hinge.rotation.z = -0.6;
      armR.hinge.rotation.z = 0.6;
      return;
    }
    if (!animate) return;

    if (state.climbing) {
      // Hand over hand: one arm reaches for the next rung while the opposite knee lifts.
      this.phase += (this.speed / 1.1) * Math.PI * 2 * dt;
      const s = Math.sin(this.phase);
      armL.hinge.rotation.z = -(2.55 + 0.35 * s);
      armR.hinge.rotation.z = 2.55 - 0.35 * s;
      armL.hinge.position.y += s * 0.04 * h;
      armR.hinge.position.y -= s * 0.04 * h;
      this.liftLeg(legL, Math.max(0, -s));
      this.liftLeg(legR, Math.max(0, s));
      body.hinge.rotation.z = s * 0.05;
      this.pose.position.x = s * 0.03 * h;
      return;
    }

    if (!state.grounded) {
      // Mid-jump: arms flung up, one knee tucked.
      armL.hinge.rotation.z = -1.1;
      armR.hinge.rotation.z = 1.1;
      this.liftLeg(legL, 0.9);
      this.liftLeg(legR, 0.25);
      return;
    }

    if (this.speed > 0.4) {
      // Walk cycle: legs step alternately, arms swing opposite, the whole body waddles.
      const stride = 1.4;
      this.phase += (this.speed / stride) * Math.PI * dt;
      const s = Math.sin(this.phase);
      const intensity = Math.min(1, this.speed / 5);
      this.liftLeg(legL, Math.max(0, s) * intensity);
      this.liftLeg(legR, Math.max(0, -s) * intensity);
      legL.hinge.rotation.z = -s * 0.12 * intensity;
      legR.hinge.rotation.z = -s * 0.12 * intensity;
      armL.hinge.rotation.z = (-0.12 - s * 0.35) * intensity;
      armR.hinge.rotation.z = (0.12 - s * 0.35) * intensity;
      armL.hinge.scale.y = 1 - Math.max(0, -s) * 0.12 * intensity;
      armR.hinge.scale.y = 1 - Math.max(0, s) * 0.12 * intensity;
      body.hinge.rotation.z = s * 0.045 * intensity;
      this.pose.position.y = Math.abs(Math.cos(this.phase)) * 0.05 * h * intensity;
      return;
    }

    // Idle: a slow breath so he never looks frozen.
    this.phase = 0;
    const breath = Math.sin(performance.now() / 600);
    body.hinge.scale.y = 1 + breath * 0.008;
    armL.hinge.rotation.z = -0.03 * breath;
    armR.hinge.rotation.z = 0.03 * breath;
  }

  dispose(): void {
    for (const part of this.parts.values()) part.mesh.material.dispose();
  }

  /** Bends the knee: the leg shortens toward the hip, lifting the foot. */
  private liftLeg(leg: Part, amount: number): void {
    leg.hinge.scale.y = 1 - amount * 0.28;
    leg.hinge.position.y += amount * 0.03 * this.height;
  }

  private createPart(spec: PartSpec, parent: Part | null): Part {
    const material = new THREE.MeshBasicMaterial({
      alphaMap: sharedMasks!.get(spec.name)!,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(planeGeometry, material);
    mesh.name = `player.rig.${spec.name}`;
    const hinge = new THREE.Object3D();
    hinge.add(mesh);
    (parent?.hinge ?? this.pose).add(hinge);
    const [pu, pv] = spec.pivot;
    const own: Point = [pu - 0.5, 1 - pv];
    const base: Point = parent ? [parent.spec.pivot[0] - 0.5, 1 - parent.spec.pivot[1]] : [0, 0];
    const part: Part = { spec, hinge, mesh, offset: [own[0] - base[0], own[1] - base[1]] };
    this.parts.set(spec.name, part);
    return part;
  }

  /** Places each part so that, unposed, the pieces line up into the original sprite. */
  private layout(): void {
    for (const part of this.parts.values()) {
      const [pu, pv] = part.spec.pivot;
      part.mesh.scale.set(this.width, this.height, 1);
      part.mesh.position.set(-(pu - 0.5) * this.width, -(1 - pv) * this.height, 0);
    }
  }
}
