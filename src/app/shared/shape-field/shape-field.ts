import { Component, DestroyRef, ElementRef, afterNextRender, inject, viewChildren } from '@angular/core';

type ShapeKind = 'circle' | 'square' | 'diamond' | 'triangle' | 'cross' | 'hexagon' | 'zigzag';

interface Shape {
  kind: ShapeKind;
  x: number; // % of viewport width
  y: number; // % of viewport height
  size: number; // px
  depth: number; // 0..1, how strongly it follows the cursor
  spin: number; // -1 or 1, rotation direction on cursor move
  color: string;
  floatDuration: number; // s
  floatDelay: number; // s
  desktopOnly: boolean;
}

const KINDS: ShapeKind[] = ['circle', 'square', 'diamond', 'triangle', 'cross', 'hexagon', 'zigzag'];
const COLORS = ['var(--color-feature)', 'var(--color-accent)', 'var(--color-secondary)', 'var(--color-text-muted)'];

const COLS = 7;
const ROWS = 5;
const MAX_SHIFT = 36; // px at full depth
const MAX_TILT = 28; // deg at full depth
const EASE = 0.07;

// Seeded so the layout is identical on every load.
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Jittered grid keeps shapes spread out without obvious rows.
function buildShapes(): Shape[] {
  const rand = mulberry32(22);
  const shapes: Shape[] = [];
  let i = 0;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (rand() < 0.25) continue;
      shapes.push({
        kind: KINDS[Math.floor(rand() * KINDS.length)],
        x: ((col + 0.15 + rand() * 0.7) / COLS) * 100,
        y: ((row + 0.15 + rand() * 0.7) / ROWS) * 100,
        size: 14 + Math.round(rand() * 20),
        depth: 0.25 + rand() * 0.75,
        spin: rand() < 0.5 ? -1 : 1,
        color: COLORS[Math.floor(rand() * COLORS.length)],
        floatDuration: 9 + rand() * 8,
        floatDelay: -rand() * 17,
        desktopOnly: i++ % 2 === 1,
      });
    }
  }
  return shapes;
}

@Component({
  selector: 'app-shape-field',
  styleUrl: './shape-field.scss',
  templateUrl: './shape-field.html',
  host: { 'aria-hidden': 'true' },
})
export class ShapeField {
  protected readonly shapes = buildShapes();
  private readonly shapeEls = viewChildren<ElementRef<HTMLElement>>('shape');

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      let targetX = 0;
      let targetY = 0;
      let currentX = 0;
      let currentY = 0;
      let frame = 0;

      const tick = () => {
        currentX += (targetX - currentX) * EASE;
        currentY += (targetY - currentY) * EASE;

        const els = this.shapeEls();
        this.shapes.forEach((shape, i) => {
          const el = els[i]?.nativeElement;
          if (!el) return;
          const dx = -currentX * shape.depth * MAX_SHIFT;
          const dy = -currentY * shape.depth * MAX_SHIFT;
          const tilt = (currentX + currentY) * shape.depth * MAX_TILT * shape.spin;
          el.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${tilt}deg)`;
        });

        const settled = Math.abs(targetX - currentX) < 0.001 && Math.abs(targetY - currentY) < 0.001;
        frame = settled ? 0 : requestAnimationFrame(tick);
      };

      const onMove = (event: PointerEvent) => {
        if (event.pointerType === 'touch') return;
        targetX = (event.clientX / window.innerWidth) * 2 - 1;
        targetY = (event.clientY / window.innerHeight) * 2 - 1;
        if (!frame) frame = requestAnimationFrame(tick);
      };

      window.addEventListener('pointermove', onMove, { passive: true });
      destroyRef.onDestroy(() => {
        window.removeEventListener('pointermove', onMove);
        cancelAnimationFrame(frame);
      });
    });
  }
}
