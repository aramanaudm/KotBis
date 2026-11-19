import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { apiError } from '../../../core/services/api';
import { environment } from '../../../../environments/environment';
import type { Report, ReportStatus } from '../models/report';
import { ReportsApiSessionService } from './reports-api-session.service';

interface ApiReport {
  reference: string;
  bus: string;
  type: 'en_panne' | 'autre';
  commentaire: string | null;
  statut: 'a_verifier' | 'confirme' | 'classe_sans_suite';
  recu_le: string;
}

interface ApiPage {
  success: boolean;
  data: {
    elements: ApiReport[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

interface Filtres {
  q: string;
  statut: ReportStatus | '';
  page: number;
  limit: number;
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
  private readonly apiSession = inject(ReportsApiSessionService);
  private readonly url = `${environment.signalementsApiUrl}/api/signalements`;
  private readonly reports = signal<Report[]>([]);
  private readonly totalInterne = signal(0);
  private readonly pagesInternes = signal(1);
  private readonly erreur = signal('');
  private readonly filtres = signal<Filtres>({ q: '', statut: '', page: 1, limit: 6 });

  readonly all = this.reports.asReadonly();
  readonly total = this.totalInterne.asReadonly();
  readonly pages = this.pagesInternes.asReadonly();
  readonly pending = computed(() => this.reports().filter((report) => report.status === 'pending'));
  readonly error = this.erreur.asReadonly();

  async load(surcharges: Partial<Filtres> = {}): Promise<void> {
    const filtres = { ...this.filtres(), ...surcharges };
    this.filtres.set(filtres);

    const jeton = await this.apiSession.obtenirJeton();
    if (!jeton) {
      this.erreur.set('Connectez-vous à l’API KotBis pour consulter les signalements.');
      return;
    }

    const params = this.params(filtres, filtres.page, filtres.limit);
    try {
      const reponse = await firstValueFrom(
        this.http.get<ApiPage>(this.url, { params, headers: this.headers(jeton) }),
      );
      this.erreur.set('');
      this.reports.set(reponse.data.elements.map((report) => this.mapper(report)));
      this.totalInterne.set(reponse.data.total);
      this.pagesInternes.set(reponse.data.pages);
    } catch (erreur) {
      this.erreur.set(apiError(erreur));
    }
  }

  async listeComplete(): Promise<Report[]> {
    const jeton = await this.apiSession.obtenirJeton();
    if (!jeton) throw new Error('Connectez-vous à l’API KotBis pour exporter les signalements.');

    const filtres = this.filtres();
    const resultats: Report[] = [];
    let page = 1;
    let pages = 1;

    do {
      const params = this.params(filtres, page, 50);
      const reponse = await firstValueFrom(
        this.http.get<ApiPage>(this.url, { params, headers: this.headers(jeton) }),
      );
      resultats.push(...reponse.data.elements.map((report) => this.mapper(report)));
      pages = reponse.data.pages;
      page += 1;
    } while (page <= pages && page <= 100000);

    return resultats;
  }

  async update(id: string, statut: ReportStatus): Promise<void> {
    const jeton = await this.apiSession.obtenirJeton();
    if (!jeton) throw new Error('Connectez-vous à l’API KotBis pour traiter les signalements.');

    await firstValueFrom(
      this.http.put(
        `${this.url}/${encodeURIComponent(id)}/statut`,
        { statut: STATUT_TO_API[statut] },
        { headers: this.headers(jeton) },
      ),
    );
    await this.load();
  }

  async dismiss(id: string): Promise<void> {
    await this.update(id, 'dismissed');
  }

  private params(filtres: Filtres, page: number, limit: number): HttpParams {
    let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    if (filtres.q.trim()) params = params.set('q', filtres.q.trim());
    if (filtres.statut) params = params.set('statut', STATUT_TO_API[filtres.statut]);
    return params;
  }

  private headers(jeton: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${jeton}` });
  }

  private mapper(report: ApiReport): Report {
    return {
      id: report.reference,
      bus: report.bus,
      type: report.type === 'en_panne' ? 'breakdown' : 'other',
      comment: report.commentaire ?? '',
      status: API_TO_STATUT[report.statut] ?? 'pending',
      date: report.recu_le,
    };
  }
}
