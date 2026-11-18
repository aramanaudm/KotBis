import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap, type Observable } from 'rxjs';
import { apiError, apiUrl } from '../../../core/services/api';
import type { Stop } from '../models/stop';

interface ApiStop {
  id: string;
  code: string;
  nom: string;
  latitude: number;
  longitude: number;
  actif: boolean;
}

@Injectable({ providedIn: 'root' })
export class StopsService {
  private readonly http = inject(HttpClient);
  private readonly stops = signal<Stop[]>([]);
  private readonly erreur = signal('');

  readonly all = this.stops.asReadonly();
  readonly active = computed(() => this.stops().filter((stop) => stop.status === 'active'));
  readonly total = computed(() => this.stops().length);
  readonly error = this.erreur.asReadonly();

  load(): void {
    this.http.get<{ success: boolean; data: ApiStop[] }>(`${apiUrl}/api/admin/stops`).subscribe({
      next: (res) => {
        this.erreur.set('');
        this.stops.set(
          res.data.map((stop) => ({
            id: String(stop.id),
            name: stop.nom,
            latitude: Number(stop.latitude),
            longitude: Number(stop.longitude),
            status: stop.actif ? 'active' : 'inactive',
          })),
        );
      },
      error: (err) => this.erreur.set(apiError(err)),
    });
  }

  create(stop: Omit<Stop, 'id'>): Observable<void> {
    const body = {
      nom: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
      actif: stop.status === 'active',
    };
    return this.http
      .post<{ success: boolean }>(`${apiUrl}/api/admin/stops`, body)
      .pipe(tap(() => this.load()), map(() => undefined));
  }

  update(id: string, stop: Omit<Stop, 'id'>): Observable<void> {
    const body: Partial<ApiStop> = {
      nom: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
      actif: stop.status === 'active',
    };
    return this.http
      .put<{ success: boolean }>(`${apiUrl}/api/admin/stops/${id}`, body)
      .pipe(tap(() => this.load()), map(() => undefined));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<{ success: boolean }>(`${apiUrl}/api/admin/stops/${id}`)
      .pipe(tap(() => this.load()), map(() => undefined));
  }
}
