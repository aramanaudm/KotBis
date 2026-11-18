import { Component, ElementRef, computed, input, output, viewChild } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import type { Zone, ZonePoint } from '../../models/zone';

@Component({
  selector: 'app-zone-map',
  imports: [TranslatePipe],
  template: `
    <div class="map">
      <svg
        #canvas
        [class.editing]="editing()"
        viewBox="0 0 600 300"
        preserveAspectRatio="none"
        role="img"
        [attr.aria-label]="'map.aria' | t"
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointercancel)="onPointerCancel()"
      >
        <defs>
          <pattern
            [attr.id]="patternId"
            width="65"
            height="65"
            patternTransform="rotate(26)"
            patternUnits="userSpaceOnUse"
          >
            <path d="M0 0V65M0 0H65" stroke="#dae2dc" stroke-width="3" />
          </pattern>
        </defs>

        <rect width="600" height="300" fill="#e8eeeb" />
        <rect width="600" height="300" [attr.fill]="'url(#' + patternId + ')'" />
        <ellipse cx="40" cy="70" rx="110" ry="90" fill="#cfe2cd" />
        <ellipse cx="550" cy="260" rx="120" ry="70" fill="#cfe2cd" />
        <path d="M-20 260 630 70M240 -20 170 320M0 30 650 200" stroke="white" stroke-width="12" />

        @if (editing()) {
          @if (vertices().length > 2) {
            <polygon class="draw-zone" [attr.points]="pointsValue(vertices())" />
          } @else if (vertices().length === 2) {
            <polyline class="draw-zone" [attr.points]="pointsValue(vertices())" />
          }

          @for (point of vertices(); track $index) {
            <circle class="draw-point" [attr.cx]="point[0]" [attr.cy]="point[1]" r="6" />
          }
        } @else {
          @for (zone of zones(); track zone.id) {
            <polygon class="map-zone" [attr.points]="pointsValue(zone.vertices)" />
          }
        }
      </svg>

      <span class="map-note">
        {{ (editing() ? 'map.zoneNote.edit' : 'map.zoneNote.preview') | t }}
      </span>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .map {
      position: relative;
      height: 260px;
      overflow: hidden;
      background: #e8eeeb;
    }

    svg {
      width: 100%;
      height: 100%;
      touch-action: none;
    }

    svg.editing {
      cursor: crosshair;
    }

    .map-zone {
      fill: #3d86e322;
      stroke: #3378d5;
      stroke-width: 2;
    }

    .draw-zone {
      fill: #216ce733;
      stroke: #216ce7;
      stroke-width: 2;
    }

    .draw-point {
      fill: #216ce7;
      stroke: white;
      stroke-width: 2;
      cursor: grab;
    }

    .map-note {
      position: absolute;
      bottom: 12px;
      left: 15px;
      padding: 6px 9px;
      color: #6b7f7d;
      font-size: 9px;
      background: #ffffffc9;
      border-radius: 6px;
      pointer-events: none;
    }
  `,
})
export class ZoneMap {
  private static nextId = 0;

  readonly mode = input<'preview' | 'edit'>('preview');
  readonly zones = input<readonly Zone[]>([]);
  readonly vertices = input<readonly ZonePoint[]>([]);

  readonly verticesChange = output<readonly ZonePoint[]>();

  protected readonly patternId = `zone-streets-${ZoneMap.nextId++}`;
  protected readonly editing = computed(() => this.mode() === 'edit');

  private readonly canvas = viewChild.required<ElementRef<SVGSVGElement>>('canvas');
  private dragIndex = -1;
  private moved = false;

  protected pointsValue(points: readonly ZonePoint[]): string {
    return points.map(([x, y]) => `${x},${y}`).join(' ');
  }

  protected onPointerDown(event: PointerEvent): void {
    if (!this.editing()) {
      return;
    }

    const point = this.toPoint(event);
    this.dragIndex = this.vertices().findIndex(
      ([x, y]) => Math.hypot(x - point[0], y - point[1]) < 16,
    );
    this.moved = false;
    this.canvas().nativeElement.setPointerCapture(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.editing() || this.dragIndex < 0 || event.buttons === 0) {
      return;
    }

    const point = this.toPoint(event);

    this.verticesChange.emit(
      this.vertices().map((vertex, index) => (index === this.dragIndex ? point : vertex)),
    );
    this.moved = true;
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.editing()) {
      return;
    }

    const canvas = this.canvas().nativeElement;

    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    if (this.dragIndex < 0 && !this.moved) {
      this.verticesChange.emit([...this.vertices(), this.toPoint(event)]);
    }

    this.dragIndex = -1;
    this.moved = false;
  }

  protected onPointerCancel(): void {
    this.dragIndex = -1;
    this.moved = false;
  }

  private toPoint(event: PointerEvent): ZonePoint {
    const rect = this.canvas().nativeElement.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 600);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 300);

    return [Math.max(0, Math.min(600, x)), Math.max(0, Math.min(300, y))];
  }
}
