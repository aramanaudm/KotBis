import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap, type Observable } from 'rxjs';
import { apiError, apiUrl } from '../../../core/services/api';
import type { Report, ReportStatus } from '../models/report';

interface ApiReport {
  id: string;
  reference: string;
  bus_plaque: string;
  type: 'en_panne' | 'autre';
  commentaire: string | null;
  statut: 'a_verifier' | 'confirme' | 'classe_sans_suite';
  cree_le: string;
}

const STATUT_TO_API: Record<ReportStatus, string> = {
  pending: 'a_verifier',
  confirmed: 'confirme',
  dismissed: 'classe_sans_suite',
};

const API_TO_STATUT: Record<string, ReportStatus> = {
  a_verifier: 'pending',
  confirme: 'confirmed',
  classe_sans_suite: 'dismissed',
};

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly reports = signal<Report[]>([]);
  private readonly erreur = signal('');

  readonly all = this.reports.asReadonly();
  readonly pending = computed(() => this.reports().filter((report) => report.status === 'pending'));
  readonly total = computed(() => this.reports().length);
  readonly error = this.erreur.asReadonly();

  load(): void {
    this.http.get<{ success: boolean; data: ApiReport[] }>(`${apiUrl}/api/admin/reports`).subscribe({
      next: (res) => {
        this.erreur.set('');
        this.reports.set(
          res.data.map((report) => ({
            id: report.reference,
            bus: report.bus_plaque,
            type: report.type === 'en_panne' ? 'breakdown' : 'other',
            comment: report.commentaire ?? '',
            status: API_TO_STATUT[report.statut] ?? 'pending',
            date: report.cree_le,
          })),
        );
      },
      error: (err) => this.erreur.set(apiError(err)),
    });
  }

  update(id: string, statut: ReportStatus): Observable<void> {
    return this.http
      .put<{ success: boolean }>(`${apiUrl}/api/admin/reports/${id}`, {
        statut: STATUT_TO_API[statut],
      })
      .pipe(tap(() => this.load()), map(() => undefined));
  }

  dismiss(id: string): Observable<void> {
    return this.http
      .delete<{ success: boolean }>(`${apiUrl}/api/admin/reports/${id}`)
      .pipe(tap(() => this.load()), map(() => undefined));
  }
}
