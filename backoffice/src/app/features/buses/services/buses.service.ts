import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap, type Observable } from 'rxjs';
import { apiError, apiUrl } from '../../../core/services/api';
import type { Bus, BusStatus } from '../models/bus';

interface ApiBus {
  id: string;
  plaque: string;
  etat: 'actif' | 'inactif' | 'en_panne';
  actif: boolean;
  trajet_code: string | null;
  ligne_code: string | null;
  direction: string | null;
}

const ETAT_TO_STATUS: Record<string, BusStatus> = {
  actif: 'active',
  inactif: 'inactive',
  en_panne: 'breakdown',
};

const STATUS_TO_ETAT: Record<BusStatus, string> = {
  active: 'actif',
  inactive: 'inactif',
  breakdown: 'en_panne',
};

@Injectable({ providedIn: 'root' })
export class BusesService {
  private readonly http = inject(HttpClient);
  private readonly buses = signal<Bus[]>([]);
  private readonly erreur = signal('');

  readonly all = this.buses.asReadonly();
  readonly total = computed(() => this.buses().length);
  readonly error = this.erreur.asReadonly();

  load(): void {
    this.http.get<{ success: boolean; data: ApiBus[] }>(`${apiUrl}/api/admin/buses`).subscribe({
      next: (res) => {
        this.erreur.set('');
        this.buses.set(
          res.data.map((bus) => ({
            id: String(bus.id),
            plate: bus.plaque,
            line: bus.ligne_code ?? '—',
            direction: bus.direction ?? '—',
            status: !bus.actif ? 'inactive' : (ETAT_TO_STATUS[bus.etat] ?? 'inactive'),
            trajetCode: bus.trajet_code ?? undefined,
          })),
        );
      },
      error: (err) => this.erreur.set(apiError(err)),
    });
  }

  create(bus: Omit<Bus, 'id'>): Observable<void> {
    const body = this.body(bus);
    return this.http
      .post<{ success: boolean; data: ApiBus }>(`${apiUrl}/api/admin/buses`, body)
      .pipe(tap(() => this.load()), map(() => undefined));
  }

  update(id: string, bus: Omit<Bus, 'id'>): Observable<void> {
    const body = this.body(bus);
    return this.http
      .put<{ success: boolean; data: ApiBus }>(`${apiUrl}/api/admin/buses/${id}`, body)
      .pipe(tap(() => this.load()), map(() => undefined));
  }

  private body(bus: Omit<Bus, 'id'>) {
    return {
      plaque: bus.plate,
      etat: STATUS_TO_ETAT[bus.status],
      trajet_code: bus.trajetCode ?? '',
    };
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<{ success: boolean }>(`${apiUrl}/api/admin/buses/${id}`)
      .pipe(tap(() => this.load()), map(() => undefined));
  }
}
