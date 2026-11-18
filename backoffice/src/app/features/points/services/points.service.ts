import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, map, tap, type Observable } from 'rxjs';
import { apiError, apiUrl } from '../../../core/services/api';
import type { PointMovement, UserBalance } from '../models/point';

interface ApiBalance {
  id: string;
  pseudo: string;
  email: string;
  points: string | number;
}

@Injectable({ providedIn: 'root' })
export class PointsService {
  private readonly http = inject(HttpClient);
  private readonly soldes = signal<readonly UserBalance[]>([]);
  private readonly mouvements = signal<readonly PointMovement[]>([]);
  private readonly erreur = signal('');

  readonly balances = this.soldes.asReadonly();
  readonly history = this.mouvements.asReadonly();
  readonly error = this.erreur.asReadonly();

  load(): void {
    forkJoin({
      balances: this.http.get<{ success: boolean; data: ApiBalance[] }>(`${apiUrl}/api/admin/points`),
      movements: this.http.get<{ success: boolean; data: PointMovement[] }>(`${apiUrl}/api/admin/points/movements`),
    }).subscribe({
      next: ({ balances, movements }) => {
        this.erreur.set('');
        this.soldes.set(
          balances.data.map((balance) => ({
            id: String(balance.id),
            pseudo: balance.pseudo,
            email: balance.email,
            points: Number(balance.points ?? 0),
          })),
        );
        this.mouvements.set(movements.data);
      },
      error: (err) => this.erreur.set(apiError(err)),
    });
  }

  adjust(userId: string, variation: number, reason: string): Observable<void> {
    return this.http
      .post<{ success: boolean }>(`${apiUrl}/api/admin/points`, { userId, variation, reason })
      .pipe(tap(() => this.load()), map(() => undefined));
  }
}
