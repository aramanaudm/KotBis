import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap, type Observable } from 'rxjs';
import { apiError, apiUrl } from '../../../core/services/api';
import type { Zone, ZonePoint } from '../models/zone';

interface ApiZone {
  id: string;
  nom: string;
  actif: boolean;
  contour: { type: string; coordinates: number[][][] };
}

function versSommets(contour: ApiZone['contour']): readonly ZonePoint[] {
  const ring = contour?.coordinates?.[0] ?? [];

  const points: ZonePoint[] = ring.map(
    ([longitude, latitude]): ZonePoint => [
      Number(longitude),
      Number(latitude),
    ],
  );

  // GeoJSON répète le premier point à la fin pour fermer le contour.
  // On retire cette répétition dans l'éditeur.
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];

    if (first[0] === last[0] && first[1] === last[1]) {
      points.pop();
    }
  }

  return points;
}

function versContour(sommets: readonly ZonePoint[]) {
  const ring = sommets.map(([longitude, latitude]) => [
    longitude,
    latitude,
  ]);

  // Fermer le contour pour respecter le format GeoJSON.
  const first = ring[0];
  const last = ring[ring.length - 1];

  if (
    first &&
    (!last || first[0] !== last[0] || first[1] !== last[1])
  ) {
    ring.push([...first]);
  }

  return {
    type: 'Polygon',
    coordinates: [ring],
  };
}

@Injectable({ providedIn: 'root' })
export class ZonesService {
  private readonly http = inject(HttpClient);
  private readonly zones = signal<Zone[]>([]);
  private readonly erreur = signal('');

  readonly all = this.zones.asReadonly();
  readonly active = computed(() => this.zones().filter((zone) => zone.status === 'active'));
  readonly total = computed(() => this.zones().length);
  readonly error = this.erreur.asReadonly();

  load(): void {
    this.http.get<{ success: boolean; data: ApiZone[] }>(`${apiUrl}/api/admin/zones`).subscribe({
      next: (res) => {
        this.erreur.set('');
        this.zones.set(
          res.data.map((zone) => ({
            id: String(zone.id),
            name: zone.nom,
            vertices: versSommets(zone.contour),
            status: zone.actif ? 'active' : 'inactive',
          })),
        );
      },
      error: (err) => this.erreur.set(apiError(err)),
    });
  }

  create(zone: Omit<Zone, 'id'>): Observable<void> {
    const body = {
      nom: zone.name,
      contour: versContour(zone.vertices),
      actif: zone.status === 'active',
    };
    return this.http
      .post<{ success: boolean }>(`${apiUrl}/api/admin/zones`, body)
      .pipe(tap(() => this.load()), map(() => undefined));
  }

  update(id: string, zone: Omit<Zone, 'id'>): Observable<void> {
    const body = {
      nom: zone.name,
      contour: versContour(zone.vertices),
      actif: zone.status === 'active',
    };
    return this.http
      .put<{ success: boolean }>(`${apiUrl}/api/admin/zones/${id}`, body)
      .pipe(tap(() => this.load()), map(() => undefined));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<{ success: boolean }>(`${apiUrl}/api/admin/zones/${id}`)
      .pipe(tap(() => this.load()), map(() => undefined));
  }
}
