import * as THREE from 'three';

export interface Exhibit {
  title: string;
  role: string;
  description: string;
  stack: string[];
  liveUrl: string;
  screenshot?: string;
}

type Axis = 'x' | 'z';

interface Vec2 {
  x: number;
  z: number;
}

interface Leg {
  axis: Axis;
  forward: Vec2;
  right: Vec2;
  origin: Vec2;
  length: number;
}

interface AABB {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

interface Alcove {
  exhibit: Exhibit;
  side: 'left' | 'right';
  leg: Leg;
  localForward: number;
  worldX: number;
  worldZ: number;
  triggerX: number;
  triggerZ: number;
}

interface Door {
  mesh: THREE.Object3D;
  exhibit: Exhibit;
}

interface ExhibitTrigger {
  exhibit: Exhibit;
  triggerX: number;
  triggerZ: number;
}

export interface MinimapDoor {
  title: string;
  x: number;
  z: number;
}

export interface MinimapLayout {
  spine: Vec2[];
  halfWidth: number;
  doors: MinimapDoor[];
}

const CORRIDOR_HALF_WIDTH = 3;
const WALL_HEIGHT = 4.5;
const WALL_THICKNESS = 0.3;
const CORRIDOR_BACK_Z = 8.5;
const ALCOVE_WIDTH = 5;
const ALCOVE_DEPTH = 3.2;
const ALCOVE_SPACING = 18;
const ALCOVE_LEAD_IN = 14;
const ALCOVES_PER_LEG = 2;
const TURN_CLEARANCE = CORRIDOR_HALF_WIDTH + 1;
const PLAYER_RADIUS = 0.4;
const EYE_HEIGHT = 1.65;
const MOVE_SPEED = 5.5;
const TURN_SPEED = 2.4;
const MOUSE_SENSITIVITY = 0.0024;
const TOUCH_SENSITIVITY = 0.006;
const MAX_PITCH = Math.PI / 2.4;
const NEARBY_DISTANCE = 4.4;
const INTERACT_DISTANCE = 5.2;
const CENTER_NDC = new THREE.Vector2(0, 0);

export type MoveDirection = 'forward' | 'backward' | 'left' | 'right';

export class DungeonScene {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly clock = new THREE.Clock();
  private legs: Leg[] = [];
  private pathEnd: Vec2 = { x: 0, z: 0 };
  private readonly alcoves: Alcove[] = [];
  private readonly walkable: AABB[] = [];
  private readonly torchLights: THREE.PointLight[] = [];
  private readonly doors: Door[] = [];
  private readonly exhibitTriggers: ExhibitTrigger[] = [];
  private backWallExhibit: Exhibit | null = null;
  private readonly raycaster = new THREE.Raycaster();

  private playerX = 0;
  private playerZ = 0;
  private yaw = 0;
  private pitch = 0;

  private readonly keys = new Set<string>();
  private readonly moveInputs = new Set<MoveDirection>();
  private pointerLocked = false;
  private touchDragId: number | null = null;
  private lastTouchX = 0;
  private lastTouchY = 0;
  private frameId = 0;
  private disposed = false;

  onNearbyChange: (exhibit: Exhibit | null) => void = () => {};
  onPointerLockChange: (locked: boolean) => void = () => {};
  onHoverChange: (hovering: boolean) => void = () => {};
  onPlayerMove: (x: number, z: number, yaw: number) => void = () => {};

  private currentNearby: Exhibit | null = null;
  private hoverExhibit: Exhibit | null = null;

  private readonly onKeyDown = (event: KeyboardEvent) => this.keys.add(event.code);
  private readonly onKeyUp = (event: KeyboardEvent) => this.keys.delete(event.code);
  private readonly onMouseMove = (event: MouseEvent) => {
    if (!this.pointerLocked) return;
    this.applyLookDelta(event.movementX, event.movementY, MOUSE_SENSITIVITY);
  };
  private readonly onClick = () => {
    if (this.hoverExhibit?.liveUrl) {
      window.open(this.hoverExhibit.liveUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (document.pointerLockElement === this.canvas) return;
    try {
      const request = this.canvas.requestPointerLock() as unknown;
      if (request instanceof Promise) request.catch(() => {});
    } catch {
      // Pointer lock isn't available in every embedding context; movement still works via keys.
    }
  };
  private readonly onPointerLockChangeEvent = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    this.onPointerLockChange(this.pointerLocked);
  };
  private readonly onPointerLockErrorEvent = () => {
    this.pointerLocked = false;
  };
  private readonly onTouchStart = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    this.touchDragId = touch.identifier;
    this.lastTouchX = touch.clientX;
    this.lastTouchY = touch.clientY;
  };
  private readonly onTouchMove = (event: TouchEvent) => {
    const touch = Array.from(event.changedTouches).find((t) => t.identifier === this.touchDragId);
    if (!touch) return;
    event.preventDefault();
    const dx = touch.clientX - this.lastTouchX;
    const dy = touch.clientY - this.lastTouchY;
    this.lastTouchX = touch.clientX;
    this.lastTouchY = touch.clientY;
    this.applyLookDelta(dx, dy, TOUCH_SENSITIVITY);
  };
  private readonly onTouchEnd = (event: TouchEvent) => {
    if (Array.from(event.changedTouches).some((t) => t.identifier === this.touchDragId)) {
      this.touchDragId = null;
    }
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    exhibits: readonly Exhibit[],
  ) {
    const bg = 0x18151d;
    this.scene.background = new THREE.Color(bg);
    this.scene.fog = new THREE.FogExp2(bg, 0.028);

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(bg);

    this.buildAlcoveLayout(exhibits);
    const start = this.legPoint(this.legs[0], 1.5, 0);
    this.playerX = start.x;
    this.playerZ = start.z;
    this.buildGeometry();
    this.buildLighting();

    canvas.addEventListener('click', this.onClick);
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.onTouchEnd);
    canvas.addEventListener('touchcancel', this.onTouchEnd);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChangeEvent);
    document.addEventListener('pointerlockerror', this.onPointerLockErrorEvent);
  }

  start(): void {
    this.clock.start();
    const loop = () => {
      if (this.disposed) return;
      const delta = Math.min(this.clock.getDelta(), 0.1);
      this.update(delta);
      this.renderer.render(this.scene, this.camera);
      this.frameId = requestAnimationFrame(loop);
    };
    this.frameId = requestAnimationFrame(loop);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  setMoveInput(direction: MoveDirection, pressed: boolean): void {
    if (pressed) this.moveInputs.add(direction);
    else this.moveInputs.delete(direction);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.canvas.removeEventListener('click', this.onClick);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChangeEvent);
    document.removeEventListener('pointerlockerror', this.onPointerLockErrorEvent);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();

    this.scene.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const material of materials) {
          for (const key of Object.keys(material) as (keyof THREE.Material)[]) {
            const value = material[key];
            if (value instanceof THREE.Texture) value.dispose();
          }
          material.dispose();
        }
      }
    });
    this.renderer.dispose();
  }

  private updateHover(): void {
    let hit: Exhibit | null = null;
    if (this.doors.length > 0) {
      this.raycaster.setFromCamera(CENTER_NDC, this.camera);
      const hits = this.raycaster.intersectObjects(this.doors.map((d) => d.mesh), false);
      if (hits.length > 0 && hits[0].distance < INTERACT_DISTANCE) {
        const door = this.doors.find((d) => d.mesh === hits[0].object);
        if (door?.exhibit.liveUrl) hit = door.exhibit;
      }
    }
    if (hit !== this.hoverExhibit) {
      this.hoverExhibit = hit;
      this.onHoverChange(hit !== null);
    }
  }

  private applyLookDelta(dx: number, dy: number, sensitivity: number): void {
    this.yaw -= dx * sensitivity;
    this.pitch = clamp(this.pitch - dy * sensitivity, -MAX_PITCH, MAX_PITCH);
  }

  /**
   * Builds a zigzagging path of straight, axis-aligned "legs" connected by
   * 90-degree turns, alternating turn direction so the corridor snakes back
   * and forth instead of running dead straight.
   */
  private buildLegs(numAlcoves: number): Leg[] {
    const legCount = Math.max(1, Math.ceil(numAlcoves / ALCOVES_PER_LEG));
    // Leave enough straight run past the last alcove in each leg before the corridor
    // turns, so a turn's swept corner doesn't cut into that alcove's own doorway.
    const lastAlcoveFarEdge = ALCOVE_LEAD_IN + (ALCOVES_PER_LEG - 1) * ALCOVE_SPACING + ALCOVE_WIDTH / 2;
    const length = lastAlcoveFarEdge + TURN_CLEARANCE;
    const legs: Leg[] = [];
    let forward: Vec2 = { x: 0, z: -1 };
    let origin: Vec2 = { x: 0, z: CORRIDOR_BACK_Z };

    for (let i = 0; i < legCount; i++) {
      const axis: Axis = forward.x !== 0 ? 'x' : 'z';
      const right = rightOf(forward);
      legs.push({ axis, forward, right, origin, length });

      const nextOrigin = { x: origin.x + forward.x * length, z: origin.z + forward.z * length };
      const turnRight = i % 2 === 0;
      forward = turnRight ? right : { x: -right.x, z: -right.z };
      origin = nextOrigin;
    }

    return legs;
  }

  private legPoint(leg: Leg, forwardDist: number, sideDist: number): Vec2 {
    return {
      x: leg.origin.x + leg.forward.x * forwardDist + leg.right.x * sideDist,
      z: leg.origin.z + leg.forward.z * forwardDist + leg.right.z * sideDist,
    };
  }

  private legRectToAABB(leg: Leg, fA: number, fB: number, sA: number, sB: number): AABB {
    const corners = [
      this.legPoint(leg, fA, sA),
      this.legPoint(leg, fA, sB),
      this.legPoint(leg, fB, sA),
      this.legPoint(leg, fB, sB),
    ];
    const xs = corners.map((c) => c.x);
    const zs = corners.map((c) => c.z);
    return { xMin: Math.min(...xs), xMax: Math.max(...xs), zMin: Math.min(...zs), zMax: Math.max(...zs) };
  }

  private buildAlcoveLayout(exhibits: readonly Exhibit[]): void {
    const alcoveExhibits = exhibits.slice(0, -1);
    this.backWallExhibit = exhibits[exhibits.length - 1] ?? null;

    this.legs = this.buildLegs(alcoveExhibits.length);

    alcoveExhibits.forEach((exhibit, i) => {
      const leg = this.legs[Math.floor(i / ALCOVES_PER_LEG)];
      const indexInLeg = i % ALCOVES_PER_LEG;
      const side: 'left' | 'right' = i % 2 === 0 ? 'left' : 'right';
      const sign = side === 'left' ? -1 : 1;
      const localForward = ALCOVE_LEAD_IN + indexInLeg * ALCOVE_SPACING;
      const world = this.legPoint(leg, localForward, 0);
      const trigger = this.legPoint(leg, localForward, sign * (CORRIDOR_HALF_WIDTH + ALCOVE_DEPTH * 0.55));
      this.alcoves.push({
        exhibit,
        side,
        leg,
        localForward,
        worldX: world.x,
        worldZ: world.z,
        triggerX: trigger.x,
        triggerZ: trigger.z,
      });
    });

    const lastLeg = this.legs[this.legs.length - 1];
    this.pathEnd = this.legPoint(lastLeg, lastLeg.length, 0);

    this.legs.forEach((leg, i) => {
      const fMin = i === 0 ? PLAYER_RADIUS : 0;
      const fMax = i === this.legs.length - 1 ? leg.length - PLAYER_RADIUS : leg.length;
      this.walkable.push(
        this.legRectToAABB(leg, fMin, fMax, -CORRIDOR_HALF_WIDTH + PLAYER_RADIUS, CORRIDOR_HALF_WIDTH - PLAYER_RADIUS),
      );
    });

    for (const alcove of this.alcoves) {
      const sign = alcove.side === 'left' ? -1 : 1;
      const outer = sign * (CORRIDOR_HALF_WIDTH + ALCOVE_DEPTH);
      this.walkable.push(
        this.legRectToAABB(
          alcove.leg,
          alcove.localForward - ALCOVE_WIDTH / 2 + PLAYER_RADIUS,
          alcove.localForward + ALCOVE_WIDTH / 2 - PLAYER_RADIUS,
          sign * CORRIDOR_HALF_WIDTH,
          outer + sign * PLAYER_RADIUS,
        ),
      );
    }

    this.exhibitTriggers.push(
      ...this.alcoves.map((a) => ({ exhibit: a.exhibit, triggerX: a.triggerX, triggerZ: a.triggerZ })),
    );
    if (this.backWallExhibit) {
      const trigger = this.legPoint(lastLeg, lastLeg.length - 1.6, 0);
      this.exhibitTriggers.push({ exhibit: this.backWallExhibit, triggerX: trigger.x, triggerZ: trigger.z });
    }
  }

  getPlayerState(): { x: number; z: number; yaw: number } {
    return { x: this.playerX, z: this.playerZ, yaw: this.yaw };
  }

  getMinimapLayout(): MinimapLayout {
    const spine = [...this.legs.map((leg) => leg.origin), this.pathEnd];
    const doors: MinimapDoor[] = this.alcoves.map((a) => ({ title: a.exhibit.title, x: a.worldX, z: a.worldZ }));
    if (this.backWallExhibit) {
      doors.push({ title: this.backWallExhibit.title, x: this.pathEnd.x, z: this.pathEnd.z });
    }
    return { spine, halfWidth: CORRIDOR_HALF_WIDTH, doors };
  }

  private buildGeometry(): void {
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x3d3945, roughness: 0.92 });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x4d4856, roughness: 0.82 });
    const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x231f29, roughness: 1 });
    const floorSpan = CORRIDOR_HALF_WIDTH * 2 + ALCOVE_DEPTH * 2;
    const lastLeg = this.legs[this.legs.length - 1];

    this.legs.forEach((leg, i) => {
      // Floor/ceiling always overhang each leg boundary by a half-width so they still
      // cover the ground under a wall that gets pushed out past the corner (below).
      this.buildLegFloorAndCeiling(leg, -CORRIDOR_HALF_WIDTH, leg.length + CORRIDOR_HALF_WIDTH, floorSpan, ceilingMaterial);

      const hasPrevTurn = i > 0;
      const hasNextTurn = i < this.legs.length - 1;
      // Turn direction alternates leg by leg (see buildLegs); on the inside of a turn
      // the two legs' walls would overlap past the corner, and on the outside they'd
      // fall short of each other, so trim the inner wall and extend the outer one by
      // exactly half the corridor width to make them meet flush at the corner.
      const prevTurnRight = (i - 1) % 2 === 0;
      const nextTurnRight = i % 2 === 0;

      for (const side of ['left', 'right'] as const) {
        const sign = side === 'left' ? -1 : 1;

        let fFrom = 0;
        if (hasPrevTurn) {
          const innerAtStart = prevTurnRight ? 1 : -1;
          fFrom = sign === innerAtStart ? CORRIDOR_HALF_WIDTH : -CORRIDOR_HALF_WIDTH;
        }
        let fTo = leg.length;
        if (hasNextTurn) {
          const innerAtEnd = nextTurnRight ? 1 : -1;
          fTo = sign === innerAtEnd ? leg.length - CORRIDOR_HALF_WIDTH : leg.length + CORRIDOR_HALF_WIDTH;
        }

        const openings = this.alcoves
          .filter((a) => a.leg === leg && a.side === side)
          .map((a) => ({ from: a.localForward - ALCOVE_WIDTH / 2, to: a.localForward + ALCOVE_WIDTH / 2 }))
          .sort((a, b) => a.from - b.from);

        let cursor = fFrom;
        for (const opening of openings) {
          this.addWallSegment(leg, sign, cursor, opening.from, wallMaterial);
          cursor = opening.to;
        }
        this.addWallSegment(leg, sign, cursor, fTo, wallMaterial);
      }
    });

    this.scene.add(this.buildEndCap(this.legs[0], 0, trimMaterial));
    this.scene.add(this.buildEndCap(lastLeg, lastLeg.length, trimMaterial));

    for (const alcove of this.alcoves) {
      this.buildAlcove(alcove, trimMaterial);
    }

    if (this.backWallExhibit) {
      this.buildBackWallDoor(this.backWallExhibit, lastLeg);
    }
  }

  private buildLegFloorAndCeiling(
    leg: Leg,
    fFrom: number,
    fTo: number,
    span: number,
    ceilingMaterial: THREE.Material,
  ): void {
    const length = fTo - fFrom;
    const mid = this.legPoint(leg, (fFrom + fTo) / 2, 0);
    const ext = axisExtent(leg.axis, length, span);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(ext.x, 0.02, ext.z), this.createFloorMaterial(ext.x, ext.z));
    floor.position.set(mid.x, -0.01, mid.z);
    this.scene.add(floor);

    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(ext.x, 0.02, ext.z), ceilingMaterial);
    ceiling.position.set(mid.x, WALL_HEIGHT + 0.01, mid.z);
    this.scene.add(ceiling);
  }

  private addWallSegment(leg: Leg, sign: 1 | -1, fFrom: number, fTo: number, material: THREE.Material): void {
    const length = fTo - fFrom;
    if (length <= 0.01) return;
    const mid = this.legPoint(leg, (fFrom + fTo) / 2, sign * CORRIDOR_HALF_WIDTH);
    const ext = axisExtent(leg.axis, length, WALL_THICKNESS);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(ext.x, WALL_HEIGHT, ext.z), material);
    wall.position.set(mid.x, WALL_HEIGHT / 2, mid.z);
    this.scene.add(wall);
  }

  private buildEndCap(leg: Leg, forwardDist: number, material: THREE.Material): THREE.Mesh {
    const pos = this.legPoint(leg, forwardDist, 0);
    const ext = axisExtent(leg.axis, WALL_THICKNESS, CORRIDOR_HALF_WIDTH * 2);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(ext.x, WALL_HEIGHT, ext.z), material);
    cap.position.set(pos.x, WALL_HEIGHT / 2, pos.z);
    return cap;
  }

  private buildAlcove(alcove: Alcove, trimMaterial: THREE.Material): void {
    const sign = alcove.side === 'left' ? -1 : 1;
    const leg = alcove.leg;
    const outer = sign * (CORRIDOR_HALF_WIDTH + ALCOVE_DEPTH);
    const inner = sign * CORRIDOR_HALF_WIDTH;

    const backPos = this.legPoint(leg, alcove.localForward, outer);
    const backExt = axisExtent(leg.axis, ALCOVE_WIDTH, WALL_THICKNESS);
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(backExt.x, WALL_HEIGHT, backExt.z), trimMaterial);
    backWall.position.set(backPos.x, WALL_HEIGHT / 2, backPos.z);
    this.scene.add(backWall);

    for (const fEdge of [alcove.localForward - ALCOVE_WIDTH / 2, alcove.localForward + ALCOVE_WIDTH / 2]) {
      const edgePos = this.legPoint(leg, fEdge, (outer + inner) / 2);
      const edgeExt = axisExtent(leg.axis, WALL_THICKNESS, ALCOVE_DEPTH);
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(edgeExt.x, WALL_HEIGHT, edgeExt.z), trimMaterial);
      sideWall.position.set(edgePos.x, WALL_HEIGHT / 2, edgePos.z);
      this.scene.add(sideWall);
    }

    const normal = { x: -sign * leg.right.x, z: -sign * leg.right.z };
    const facingY = Math.atan2(normal.x, normal.z);
    const doorPos = this.legPoint(leg, alcove.localForward, outer - sign * (WALL_THICKNESS / 2 + 0.03));
    const hitboxPos = this.legPoint(leg, alcove.localForward, outer - sign * (WALL_THICKNESS / 2 + 0.06));

    this.mountDoorContent(alcove.exhibit, doorPos.x, doorPos.z, facingY);
    this.mountDoorHitbox(alcove.exhibit, hitboxPos.x, hitboxPos.z, facingY, ALCOVE_WIDTH - 0.4, WALL_HEIGHT - 0.4);

    const torch1 = this.legPoint(leg, alcove.localForward - (ALCOVE_WIDTH / 2 - 0.35), (outer + inner) / 2);
    const torch2 = this.legPoint(leg, alcove.localForward + (ALCOVE_WIDTH / 2 - 0.35), (outer + inner) / 2);
    this.mountTorchPair(torch1.x, torch1.z, torch2.x, torch2.z);
  }

  private buildBackWallDoor(exhibit: Exhibit, leg: Leg): void {
    const normal = { x: -leg.forward.x, z: -leg.forward.z };
    const facingY = Math.atan2(normal.x, normal.z);
    const doorPos = this.legPoint(leg, leg.length - (WALL_THICKNESS / 2 + 0.03), 0);
    const hitboxPos = this.legPoint(leg, leg.length - (WALL_THICKNESS / 2 + 0.06), 0);

    this.mountDoorContent(exhibit, doorPos.x, doorPos.z, facingY);
    this.mountDoorHitbox(exhibit, hitboxPos.x, hitboxPos.z, facingY, CORRIDOR_HALF_WIDTH * 2 - 0.6, WALL_HEIGHT - 0.4);

    const torch1 = this.legPoint(leg, leg.length - 1.3, -(CORRIDOR_HALF_WIDTH - 0.6));
    const torch2 = this.legPoint(leg, leg.length - 1.3, CORRIDOR_HALF_WIDTH - 0.6);
    this.mountTorchPair(torch1.x, torch1.z, torch2.x, torch2.z);
  }

  private mountDoorContent(exhibit: Exhibit, x: number, z: number, rotationY: number): void {
    if (exhibit.screenshot) {
      const texture = new THREE.TextureLoader().load(exhibit.screenshot);
      texture.colorSpace = THREE.SRGBColorSpace;
      const photoMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55 });
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.7), photoMaterial);
      photo.position.set(x, 2.35, z);
      photo.rotation.y = rotationY;
      this.scene.add(photo);

      const plaqueTexture = createPlaqueTexture(exhibit.title, 512, 176);
      const plaqueMaterial = new THREE.MeshStandardMaterial({ map: plaqueTexture, roughness: 0.75 });
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.65), plaqueMaterial);
      plaque.position.set(x, 1.15, z);
      plaque.rotation.y = rotationY;
      this.scene.add(plaque);
    } else {
      const plaqueTexture = createPlaqueTexture(exhibit.title, 512, 256);
      const plaqueMaterial = new THREE.MeshStandardMaterial({ map: plaqueTexture, roughness: 0.75 });
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), plaqueMaterial);
      plaque.position.set(x, 2.1, z);
      plaque.rotation.y = rotationY;
      this.scene.add(plaque);
    }
  }

  private mountDoorHitbox(
    exhibit: Exhibit,
    x: number,
    z: number,
    rotationY: number,
    width: number,
    height: number,
  ): void {
    const hitboxMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const hitbox = new THREE.Mesh(new THREE.PlaneGeometry(width, height), hitboxMaterial);
    hitbox.position.set(x, WALL_HEIGHT / 2, z);
    hitbox.rotation.y = rotationY;
    this.scene.add(hitbox);
    this.doors.push({ mesh: hitbox, exhibit });
  }

  private mountTorchPair(x1: number, z1: number, x2: number, z2: number): void {
    for (const [x, z] of [
      [x1, z1],
      [x2, z2],
    ] as const) {
      const light = new THREE.PointLight(0xffab5e, 1.9, 8.5, 1.8);
      light.position.set(x, 2.5, z);
      this.scene.add(light);
      this.torchLights.push(light);

      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffb347 }),
      );
      flame.position.copy(light.position);
      this.scene.add(flame);
    }
  }

  private buildLighting(): void {
    this.scene.add(new THREE.AmbientLight(0x4a4658, 1.1));
    this.scene.add(new THREE.HemisphereLight(0x6a6480, 0x2a2620, 0.9));

    let i = 0;
    for (const leg of this.legs) {
      for (let f = 4; f < leg.length; f += 8) {
        const sign = i % 2 === 0 ? -1 : 1;
        const pos = this.legPoint(leg, f, sign * (CORRIDOR_HALF_WIDTH - 0.3));
        const light = new THREE.PointLight(0xffab5e, 2.1, 15, 1.6);
        light.position.set(pos.x, 2.6, pos.z);
        this.scene.add(light);
        this.torchLights.push(light);

        const flame = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xffb347 }),
        );
        flame.position.copy(light.position);
        this.scene.add(flame);
        i++;
      }
    }
  }

  private createFloorMaterial(sizeX: number, sizeZ: number): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#29252e';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 125, 125);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    const tileSize = 2;
    texture.repeat.set(sizeX / tileSize, sizeZ / tileSize);
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
  }

  private update(delta: number): void {
    if (this.keys.has('ArrowLeft')) this.yaw += TURN_SPEED * delta;
    if (this.keys.has('ArrowRight')) this.yaw -= TURN_SPEED * delta;

    const forward = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) +
      (this.moveInputs.has('forward') ? 1 : 0) -
      (this.moveInputs.has('backward') ? 1 : 0);
    const strafe = (this.keys.has('KeyD') ? 1 : 0) -
      (this.keys.has('KeyA') ? 1 : 0) +
      (this.moveInputs.has('right') ? 1 : 0) -
      (this.moveInputs.has('left') ? 1 : 0);

    if (forward !== 0 || strafe !== 0) {
      const len = Math.hypot(forward, strafe) || 1;
      const nf = (forward / len) * MOVE_SPEED * delta;
      const ns = (strafe / len) * MOVE_SPEED * delta;
      const sinYaw = Math.sin(this.yaw);
      const cosYaw = Math.cos(this.yaw);
      const dx = -sinYaw * nf + cosYaw * ns;
      const dz = -cosYaw * nf - sinYaw * ns;

      if (this.isWalkable(this.playerX + dx, this.playerZ)) this.playerX += dx;
      if (this.isWalkable(this.playerX, this.playerZ + dz)) this.playerZ += dz;
    }

    this.camera.position.set(this.playerX, EYE_HEIGHT, this.playerZ);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    const t = this.clock.elapsedTime;
    this.torchLights.forEach((light, i) => {
      light.intensity = 2.1 + Math.sin(t * 6 + i * 1.7) * 0.2 + Math.sin(t * 13 + i) * 0.08;
    });

    this.updateNearby();
    this.updateHover();
    this.onPlayerMove(this.playerX, this.playerZ, this.yaw);
  }

  private isWalkable(x: number, z: number): boolean {
    return this.walkable.some((r) => x >= r.xMin && x <= r.xMax && z >= r.zMin && z <= r.zMax);
  }

  private updateNearby(): void {
    const found = this.exhibitTriggers.find(
      (t) => Math.hypot(this.playerX - t.triggerX, this.playerZ - t.triggerZ) < NEARBY_DISTANCE,
    );
    const nextExhibit = found?.exhibit ?? null;
    if (nextExhibit !== this.currentNearby) {
      this.currentNearby = nextExhibit;
      this.onNearbyChange(nextExhibit);
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function rightOf(forward: Vec2): Vec2 {
  return { x: -forward.z, z: forward.x };
}

function axisExtent(axis: Axis, forwardLen: number, sideLen: number): Vec2 {
  return axis === 'z' ? { x: sideLen, z: forwardLen } : { x: forwardLen, z: sideLen };
}

function createPlaqueTexture(title: string, width: number, height: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2a1d13';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const y = (height / 6) * i;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(i) * 3);
    ctx.lineTo(width, y + Math.cos(i) * 3);
    ctx.stroke();
  }

  const border = Math.max(6, width * 0.02);
  ctx.strokeStyle = '#9c7a45';
  ctx.lineWidth = border;
  ctx.strokeRect(border / 2, border / 2, width - border, height - border);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(border * 2, border * 2, width - border * 4, height - border * 4);

  ctx.font = `bold ${Math.round(height * 0.22)}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const words = title.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > width * 0.8 && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const lineHeight = height * 0.26;
  const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => {
    const y = startY + i * lineHeight;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(l, width / 2 + 2, y + 2);
    ctx.fillStyle = '#e7d3a1';
    ctx.fillText(l, width / 2, y);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
