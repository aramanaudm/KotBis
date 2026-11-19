import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';

import { ApiSessionService } from './api-session.service';
import { COMMUNITY_BUSES } from './community-buses';
import { COMMUNITY_SESSION } from './community-session';
import { REPORT_CATEGORIES } from './report-categories';
import type { BusReport } from './report.model';

export interface ReportPosition {
  readonly latitude: number;
  readonly longitude: number;
}

export interface ReportDraft {
  readonly busId: string;
  readonly categoryId: string;
  readonly commentaire: string;
  readonly observeLe: string;
  readonly cleIdempotence: string;
  readonly position?: ReportPosition | null;
}

interface ApiSignalement {
  reference: string;
  auteurId: string;
  busId: string | null;
  categorie: string | null;
  statut: string;
  recuLe: string;
}

interface ApiCreation {
  success: boolean;
  idempotent: boolean;
  data: ApiSignalement;
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly user = inject(COMMUNITY_SESSION);
  private readonly apiSession = inject(ApiSessionService);
  private readonly items = signal<readonly BusReport[]>([]);
  readonly reports = this.items.asReadonly();

  async createReport(draft: ReportDraft): Promise<BusReport> {
    const user = this.user();
    if (!user) throw new Error('Vous devez être connecté pour signaler un bus.');
    const bus = COMMUNITY_BUSES.find((item) => item.id === draft.busId);
    if (!bus) throw new Error('Sélectionnez un bus valide.');
    const category = REPORT_CATEGORIES.find((item) => item.id === draft.categoryId);
    if (!category) throw new Error('Choisissez une catégorie de signalement valide.');

    const corps: Record<string, unknown> = {
      busId: bus.apiBusId,
      categorie: draft.categoryId,
      commentaire: draft.commentaire,
      observeLe: draft.observeLe,
      cleIdempotence: draft.cleIdempotence,
    };
    if (draft.position) {
      corps['position'] = draft.position;
      corps['consentementGps'] = true;
    }

    const jeton = await this.apiSession.obtenirJeton();
    if (!jeton) throw new Error('Connectez-vous à l’API KotBis pour signaler un bus.');
    const headers = new HttpHeaders({ Authorization: `Bearer ${jeton}` });

    try {
      const reponse = await firstValueFrom(
        this.http.post<ApiCreation>(`${environment.apiUrl}/api/signalements`, corps, { headers }),
      );
      const rapport: BusReport = {
        id: reponse.data.reference,
        busId: reponse.data.busId ?? bus.apiBusId,
        busLine: bus.line,
        categoryId: reponse.data.categorie ?? draft.categoryId,
        categoryLabel: category.label,
        userId: reponse.data.auteurId,
        userName: user.pseudo,
        status: 'A_VERIFIER',
        createdAt: reponse.data.recuLe,
      };
      this.items.update((items) => [rapport, ...items]);
      return rapport;
    } catch (erreur) {
      throw new Error(messageErreur(erreur), { cause: erreur });
    }
  }
}

function messageErreur(erreur: unknown): string {
  if (erreur instanceof HttpErrorResponse) {
    const contenu = erreur.error as { message?: string; details?: readonly { message?: string }[] } | null;
    return contenu?.message ?? contenu?.details?.[0]?.message ?? "Le signalement n'a pas abouti. Réessayez.";
  }
  return erreur instanceof Error ? erreur.message : "Le signalement n'a pas abouti. Réessayez.";
}
