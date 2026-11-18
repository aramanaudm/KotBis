import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap, type Observable } from 'rxjs';
import { apiError, apiUrl } from '../../../core/services/api';
import type { TransitRoute } from '../models/route';

interface ApiRoute {
  id: string;
  code: string;
  nom: string;
  ligne_code: string | null;
  direction: string | null;
  stops: string[];
  stop_ids: string[];
  actif: boolean;
}

@Injectable({ providedIn: 'root' })
export class RoutesService {
  private readonly http = inject(HttpClient);
  private readonly routes = signal<TransitRoute[]>([]);
  private readonly erreur = signal('');

  readonly all = this.routes.asReadonly();
  readonly total = computed(() => this.routes().length);
  readonly active = computed(() => this.routes().filter((route) => route.status === 'active'));
  readonly error = this.erreur.asReadonly();

  load(): void {
    this.http.get<{ success: boolean; data: ApiRoute[] }>(`${apiUrl}/api/admin/routes`).subscribe({
      next: (res) => {
        this.erreur.set('');
        this.routes.set(
          res.data.map((route) => ({
            id: String(route.id),
            code: route.code,
            name: route.nom,
            line: route.ligne_code ?? '—',
            direction: route.direction ?? '—',
            stops: route.stops ?? [],
            status: route.actif ? 'active' : 'inactive',
          })),
        );
      },
      error: (err) => this.erreur.set(apiError(err)),
    });
  }

  create(route: Omit<TransitRoute, 'id'>, stopIds: readonly string[]): Observable<void> {
    return this.http
      .post<{ success: boolean }>(`${apiUrl}/api/admin/routes`, this.body(route, stopIds))
      .pipe(tap(() => this.load()), map(() => undefined));
  }

  update(id: string, route: Omit<TransitRoute, 'id'>, stopIds: readonly string[]): Observable<void> {
    return this.http
      .put<{ success: boolean }>(`${apiUrl}/api/admin/routes/${id}`, this.body(route, stopIds))
      .pipe(tap(() => this.load()), map(() => undefined));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<{ success: boolean }>(`${apiUrl}/api/admin/routes/${id}`)
      .pipe(tap(() => this.load()), map(() => undefined));
  }

  private body(route: Omit<TransitRoute, 'id'>, stopIds: readonly string[]) {
    return {
      code: route.code || undefined,
      ligne_code: route.line,
      nom: route.name,
      direction: route.direction || 'aller',
      actif: route.status === 'active',
      stop_ids: stopIds,
    };
  }
}
