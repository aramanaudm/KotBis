import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import type { Zone, ZonePoint } from '../../models/zone';

@Component({
  selector: 'app-zone-map',
  standalone: true,
  template: `
    <div class="map-wrapper">
      <div #canvas class="map" aria-label="Carte des zones"></div>

      <span class="map-note">
        {{
          mode() === 'edit'
            ? 'Cliquez pour ajouter un point · déplacez les points pour ajuster'
            : 'Zones de couverture du réseau'
        }}
      </span>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      min-width: 0;
    }

    .map-wrapper {
      position: relative;
      overflow: hidden;
      isolation: isolate;
    }

    .map {
      width: 100%;
      height: 360px;
      background: #e8eef5;
      z-index: 0;
    }

    .map-note {
      position: absolute;
      bottom: 25px;
      left: 10px;
      right: 10px;
      z-index: 1;
      width: fit-content;
      padding: 7px 10px;
      color: #24364b;
      font-size: 11px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 6px;
      pointer-events: none;
    }
  `,
})
export class ZoneMap implements AfterViewInit, OnDestroy {
  readonly mode = input<'preview' | 'edit'>('preview');
  readonly zones = input<readonly Zone[]>([]);
  readonly vertices = input<readonly ZonePoint[]>([]);
  readonly verticesChange = output<readonly ZonePoint[]>();

  private readonly canvas =
    viewChild.required<ElementRef<HTMLDivElement>>('canvas');

  private readonly ready = signal(false);

  private map?: L.Map;
  private layers?: L.LayerGroup;
  private observer?: ResizeObserver;
  private framed = false;

  constructor() {
    effect(() => {
      const ready = this.ready();
      const mode = this.mode();
      const zones = this.zones();
      const vertices = this.vertices();

      if (ready) {
        this.render(mode, zones, vertices);
      }
    });
  }

  ngAfterViewInit(): void {
    this.map = L.map(this.canvas().nativeElement, {
      scrollWheelZoom: false,
      doubleClickZoom: false,
    }).setView([-20.25, 57.55], 10);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);

    this.layers = L.layerGroup().addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      if (this.mode() !== 'edit') {
        return;
      }

      // Dans notre modèle : [longitude, latitude].
      const point: ZonePoint = [
        event.latlng.lng,
        event.latlng.lat,
      ];

      this.verticesChange.emit([...this.vertices(), point]);
    });

    this.observer = new ResizeObserver(() => {
      this.map?.invalidateSize();
    });

    this.observer.observe(this.canvas().nativeElement);
    this.ready.set(true);
  }

  private render(
    mode: 'preview' | 'edit',
    zones: readonly Zone[],
    vertices: readonly ZonePoint[],
  ): void {
    if (!this.map || !this.layers) {
      return;
    }

    this.layers.clearLayers();
    const bounds = L.latLngBounds([]);

    if (mode === 'edit') {
      const points = this.toLatLngs(vertices);

      if (points.length >= 3) {
        L.polygon(points, {
          color: '#2069e7',
          fillColor: '#2069e7',
          fillOpacity: 0.2,
          weight: 2,
          interactive: false,
        }).addTo(this.layers);
      } else if (points.length === 2) {
        L.polyline(points, {
          color: '#2069e7',
          weight: 2,
          interactive: false,
        }).addTo(this.layers);
      }

      points.forEach((point, index) => {
        bounds.extend(point);

        const marker = L.marker(point, {
          draggable: true,
          bubblingMouseEvents: false,
          icon: L.divIcon({
            className: '',
            html: `
              <div style="
                width:16px;
                height:16px;
                border:2px solid white;
                border-radius:50%;
                background:#2069e7;
                box-shadow:0 1px 5px #0006;
              "></div>
            `,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        }).addTo(this.layers!);

        marker.on('dragend', () => {
          const position = marker.getLatLng();

          const updated: readonly ZonePoint[] = this.vertices().map(
            (vertex, vertexIndex): ZonePoint =>
              vertexIndex === index
                ? [position.lng, position.lat]
                : vertex,
          );

          this.verticesChange.emit(updated);
        });
      });
    } else {
      for (const zone of zones) {
        const valide =
          zone.vertices.length >= 3 &&
          zone.vertices.every(
            ([longitude, latitude]) =>
              Number.isFinite(longitude) &&
              Number.isFinite(latitude) &&
              longitude >= -180 &&
              longitude <= 180 &&
              latitude >= -90 &&
              latitude <= 90,
          );

        if (!valide) {
          continue;
        }

        const points = this.toLatLngs(zone.vertices);

        const polygon = L.polygon(points, {
          color: '#2069e7',
          fillColor: '#2069e7',
          fillOpacity: 0.3,
          weight: 3,
        }).addTo(this.layers);

        const label = document.createElement('span');
        label.textContent = zone.name;
        polygon.bindPopup(label);

        points.forEach((point) => bounds.extend(point));
      }
    }

    // Centrer la carte sur les contours valides.
    if (!this.framed && bounds.isValid()) {
      this.map.fitBounds(bounds, {
        padding: [25, 25],
        maxZoom: 14,
      });

      this.framed = true;
    }
  }

  private toLatLngs(points: readonly ZonePoint[]): L.LatLngTuple[] {
    return points.map(
      ([longitude, latitude]): L.LatLngTuple => [
        latitude,
        longitude,
      ],
    );
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.map?.remove();
  }
}