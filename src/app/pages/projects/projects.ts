import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  ViewChild,
  signal,
} from '@angular/core';
import { DungeonScene, Exhibit, MinimapLayout, MoveDirection } from './dungeon-scene';

export type { Exhibit };

@Component({
  imports: [],
  selector: 'app-projects',
  styleUrl: './projects.scss',
  templateUrl: './projects.html',
})
export class Projects implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') private canvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('viewport') private viewportRef?: ElementRef<HTMLDivElement>;
  @ViewChild('minimap') private minimapRef?: ElementRef<HTMLCanvasElement>;

  protected readonly exhibits: Exhibit[] = [
    {
      title: 'Ehlers Inc.',
      role: 'Custom WordPress Theme',
      description:
        'Fully custom WordPress theme built from scratch for a public financial advisory firm. Includes a custom REST API to handle upcoming and recently completed bond sale data and documentation.',
      stack: ['WordPress', 'PHP', 'JavaScript', 'SCSS'],
      liveUrl: 'https://www.ehlers-inc.com/',
      screenshot: 'images/ehlers-inc.jpg',
    },
    {
      title: 'Media Loft',
      role: 'Custom WordPress Theme',
      description:
        'Custom WordPress theme for a live events agency. Utilizes Lottie animation files across the site.',
      stack: ['WordPress', 'PHP', 'JavaScript', 'jQuery'],
      liveUrl: 'https://www.medialoft.com/',
      screenshot: 'images/medialoft.png',
    },
    {
      title: 'Mercury Mosaics',
      role: 'Shopify Theme',
      description:
        'Shopify storefront for an artisan tile studio. Responsible for full overhaul of tile filtering functionality across the site.',
      stack: ['Shopify', 'Liquid', 'JavaScript', 'CSS'],
      liveUrl: 'https://mercurymosaics.com/',
      screenshot: 'images/mercury-mosaics.jpg',
    },
    {
      title: 'Trio Capital',
      role: 'Custom WordPress Theme',
      description:
        'Custom WordPress theme for an equipment finance and working capital lender. Built and deployed in one week.',
      stack: ['WordPress', 'PHP', 'JavaScript', 'CSS'],
      liveUrl: 'https://triocapital.com/',
      screenshot: 'images/trio-capital.jpg',
    },
    {
      title: 'Elite Team',
      role: 'Custom WordPress Theme',
      description: 'Custom theme for a small business financial lender. Built with increasing leads in mind, this simple landing page increased contact form fills by nearly 80%.',
      stack: ['WordPress', 'PHP', 'JavaScript', 'SCSS'],
      liveUrl: 'https://eliteteam.com/',
      screenshot: 'images/elite-team.png',
    },
    {
      title: 'Northstar Water',
      role: 'Custom WordPress Theme',
      description: 'Custom theme for a water treatment supplier. Includes custom built servicer and wholesaler locators that finds the nearest location to the user from over two thousand locations.',
      stack: ['WordPress', 'PHP', 'JavaScript', 'SCSS'],
      liveUrl: 'https://www.northstarwater.com/',
      screenshot: 'images/northstar-water.png',
    },
    {
      title: 'Gorillamade',
      role: 'Custom WordPress Theme',
      description: 'Custom WordPress theme for an online store that sells utility & outdoor products. WooCommerce storefront.',
      stack: ['WordPress', 'WooCommerce', 'PHP', 'JavaScript', 'SCSS'],
      liveUrl: 'https://gorillamade.com/',
      screenshot: 'images/gorillamade.png',
    },
    {
      title: 'Rocket55',
      role: 'Custom WordPress Theme',
      description: 'Custom theme for a digital marketing agency. Built in collaboration with a team of three other developers.',
      stack: ['WordPress', 'PHP', 'JavaScript', 'SCSS'],
      liveUrl: 'https://www.rocket55.com/',
      screenshot: 'images/rocket55.png',
    },
    {
      title: 'United Properties',
      role: 'Custom WordPress Theme',
      description: 'Custom WordPress theme for commercial real estate builders. Built over a legacy code base, cutting dev time nearly in half.',
      stack: ['WordPress', 'PHP', 'JavaScript', 'SCSS'],
      liveUrl: 'https://www.uproperties.com/',
      screenshot: 'images/united-properties.png',
    },
    {
      title: 'Copperhead Wire',
      role: 'Custom WordPress Theme',
      description: 'Custom theme for a manufacturer of copper-clad steel tracer wire. Built and deployed in two weeks in collaboration with two other developers.',
      stack: ['WordPress', 'PHP', 'JavaScript', 'SCSS'],
      liveUrl: 'https://copperheadwire.com/',
      screenshot: 'images/copperhead-wire.png',
    },
  ];

  protected readonly viewMode = signal<'explore' | 'list'>('explore');
  protected readonly touchFriendly = signal(false);
  protected readonly pointerLocked = signal(false);
  protected readonly nearbyExhibit = signal<Exhibit | null>(null);
  protected readonly visitedTitles = signal<ReadonlySet<string>>(new Set());
  protected readonly hoveringDoor = signal(false);

  private scene?: DungeonScene;
  private resizeObserver?: ResizeObserver;
  private minimapCtx?: CanvasRenderingContext2D;
  private minimapLayout?: MinimapLayout;
  private lastPlayerState = { x: 0, z: 0, yaw: 0 };

  constructor(private readonly ngZone: NgZone) { }

  ngAfterViewInit(): void {
    if (window.matchMedia('(pointer: coarse)').matches) {
      this.touchFriendly.set(true);
    }
    this.ensureScene();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.scene?.dispose();
  }

  protected setViewMode(mode: 'explore' | 'list'): void {
    this.viewMode.set(mode);
    if (mode === 'explore') {
      setTimeout(() => this.ensureScene());
    } else {
      this.resizeObserver?.disconnect();
      this.resizeObserver = undefined;
      this.scene?.dispose();
      this.scene = undefined;
      this.minimapCtx = undefined;
      this.minimapLayout = undefined;
      this.nearbyExhibit.set(null);
      this.pointerLocked.set(false);
      this.hoveringDoor.set(false);
    }
  }

  protected press(direction: MoveDirection, pressed: boolean): void {
    this.scene?.setMoveInput(direction, pressed);
  }

  private ensureScene(): void {
    if (this.scene || !this.canvasRef || !this.viewportRef) return;

    const canvas = this.canvasRef.nativeElement;
    const viewport = this.viewportRef.nativeElement;

    this.ngZone.runOutsideAngular(() => {
      const scene = new DungeonScene(canvas, this.exhibits);
      scene.resize(viewport.clientWidth, viewport.clientHeight);

      scene.onNearbyChange = (exhibit) => {
        this.ngZone.run(() => {
          this.nearbyExhibit.set(exhibit);
          if (exhibit) {
            this.visitedTitles.update((set) => new Set(set).add(exhibit.title));
          }
        });
      };
      scene.onPointerLockChange = (locked) => {
        this.ngZone.run(() => this.pointerLocked.set(locked));
      };
      scene.onHoverChange = (hovering) => {
        this.ngZone.run(() => this.hoveringDoor.set(hovering));
      };

      this.minimapLayout = scene.getMinimapLayout();
      this.lastPlayerState = scene.getPlayerState();
      this.minimapCtx = this.minimapRef?.nativeElement.getContext('2d') ?? undefined;
      this.resizeMinimap();
      scene.onPlayerMove = (x, z, yaw) => {
        this.lastPlayerState = { x, z, yaw };
        this.redrawMinimap();
      };

      scene.start();
      this.scene = scene;

      this.resizeObserver = new ResizeObserver(() => {
        scene.resize(viewport.clientWidth, viewport.clientHeight);
      });
      this.resizeObserver.observe(viewport);
    });
  }

  @HostListener('window:resize')
  protected onResize(): void {
    if (this.scene && this.viewportRef) {
      this.scene.resize(this.viewportRef.nativeElement.clientWidth, this.viewportRef.nativeElement.clientHeight);
    }
    this.resizeMinimap();
  }

  private resizeMinimap(): void {
    const canvas = this.minimapRef?.nativeElement;
    if (!canvas || !this.minimapCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    this.minimapCtx.scale(dpr, dpr);
    this.redrawMinimap();
  }

  private redrawMinimap(): void {
    const canvas = this.minimapRef?.nativeElement;
    if (!canvas || !this.minimapCtx || !this.minimapLayout) return;
    this.drawMinimap(
      this.minimapCtx,
      this.minimapLayout,
      canvas.clientWidth,
      canvas.clientHeight,
      this.lastPlayerState.x,
      this.lastPlayerState.z,
      this.lastPlayerState.yaw,
    );
  }

  private drawMinimap(
    ctx: CanvasRenderingContext2D,
    layout: MinimapLayout,
    width: number,
    height: number,
    playerX: number,
    playerZ: number,
    yaw: number,
  ): void {
    const margin = 10;
    const pad = layout.halfWidth + 2;
    const xs = [...layout.spine.map((p) => p.x), ...layout.doors.map((d) => d.x)];
    const zs = [...layout.spine.map((p) => p.z), ...layout.doors.map((d) => d.z)];
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minZ = Math.min(...zs) - pad;
    const maxZ = Math.max(...zs) + pad;
    const rangeX = Math.max(maxX - minX, 1);
    const rangeZ = Math.max(maxZ - minZ, 1);
    const scale = Math.min((width - margin * 2) / rangeX, (height - margin * 2) / rangeZ);
    const padX = (width - rangeX * scale) / 2;
    const padZ = (height - rangeZ * scale) / 2;
    const toX = (worldX: number) => padX + (worldX - minX) * scale;
    const toY = (worldZ: number) => padZ + (maxZ - worldZ) * scale;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = Math.max(layout.halfWidth * 2 * scale, 2);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    layout.spine.forEach((point, i) => {
      const x = toX(point.x);
      const y = toY(point.z);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const visited = this.visitedTitles();
    for (const door of layout.doors) {
      ctx.beginPath();
      ctx.arc(toX(door.x), toY(door.z), 3, 0, Math.PI * 2);
      ctx.fillStyle = visited.has(door.title) ? 'rgba(127, 224, 180, 0.9)' : 'rgba(255, 171, 94, 0.6)';
      ctx.fill();
    }

    const dirX = -Math.sin(yaw);
    const dirY = Math.cos(yaw);
    const angle = Math.atan2(dirX, -dirY);
    ctx.save();
    ctx.translate(toX(playerX), toY(playerZ));
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }
}
