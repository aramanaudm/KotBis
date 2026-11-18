import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth/auth.service';

/** Arrêt d'un favori ; `code` et `nom` valent `null` si l'arrêt n'existe plus. */
export interface ArretFavori {
  readonly id: number;
  readonly code: string | null;
  readonly nom: string | null;
}

/** Favori renvoyé par l'API (GET/POST /api/favoris, KBE-40), enregistré dans la table favoris. */
export interface Favori {
  readonly id: number;
  readonly type: 'destination' | 'trajet';
  readonly depart: ArretFavori | null;
  readonly arrivee: ArretFavori;
  readonly libelle: string | null;
  readonly creeLe: string;
  /** EF-FAV-006 : `false` si un arrêt ou sa ligne n'est plus desservi. */
  readonly disponible: boolean;
}

/** Trajet de la table trajets proposé à l'ajout (GET /api/favoris/trajets). */
export interface TrajetPropose {
  readonly trajetId: number;
  readonly ligne: string;
  readonly nom: string;
  readonly direction: string;
  readonly depart: { readonly id: number; readonly nom: string };
  readonly arrivee: { readonly id: number; readonly nom: string };
}

export class FavorisError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'FavorisError';
  }
}

interface ApiErrorBody {
  erreur?: { code?: string; message?: string };
}

/**
 * Favoris du voyageur connecté, enregistrés en base par l'API Back-End (KBE-40).
 * Rien n'est conservé sur l'appareil : la liste est rechargée à chaque connexion.
 */
@Injectable({ providedIn: 'root' })
export class FavorisService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = `${environment.apiUrl}/favoris`;

  private readonly liste = signal<readonly Favori[]>([]);
  private readonly proposes = signal<readonly TrajetPropose[]>([]);

  /** Favoris du compte connecté, du plus récent au plus ancien. */
  readonly favoris = this.liste.asReadonly();
  /** Trajets proposés qui ne sont pas encore en favori. */
  readonly trajetsAjoutables = computed(() => this.proposes().filter((trajet) => !this.estFavori(trajet)));

  constructor() {
    // Connexion : charge les favoris du compte ; déconnexion : vide la liste.
    effect(() => {
      const connecte = this.auth.user() !== null;
      untracked(() => {
        if (connecte) {
          void this.charger().catch(() => undefined);
        } else {
          this.liste.set([]);
          this.proposes.set([]);
        }
      });
    });
  }

  async charger(): Promise<void> {
    const reponse = await this.appeler(() =>
      this.http.get<{ elements: Favori[] }>(this.api, { headers: this.entetes() }),
    );
    this.liste.set(reponse.elements);
  }

  /** Recherche dans les trajets du réseau (nom, direction, ligne ou arrêt). */
  async rechercherTrajets(recherche = ''): Promise<void> {
    const params = recherche.trim() ? new HttpParams().set('recherche', recherche.trim()) : undefined;
    const reponse = await this.appeler(() =>
      this.http.get<{ elements: TrajetPropose[] }>(`${this.api}/trajets`, { headers: this.entetes(), params }),
    );
    this.proposes.set(reponse.elements);
  }

  /** Enregistre le trajet en favori : son premier et son dernier arrêt. */
  async ajouter(trajet: TrajetPropose): Promise<Favori> {
    const favori = await this.appeler(() =>
      this.http.post<Favori>(
        this.api,
        { type: 'trajet', arretDepartId: trajet.depart.id, arretArriveeId: trajet.arrivee.id },
        { headers: this.entetes() },
      ),
    );
    this.liste.update((favoris) => [favori, ...favoris]);
    return favori;
  }

  async retirer(favori: Favori): Promise<void> {
    try {
      await this.appeler(() => this.http.delete<void>(`${this.api}/${favori.id}`, { headers: this.entetes() }));
    } catch (erreur) {
      // Déjà supprimé (autre appareil) : il suffit de le retirer de la liste.
      if (!(erreur instanceof FavorisError && erreur.code === 'FAVORI_INTROUVABLE')) throw erreur;
    }
    this.liste.update((favoris) => favoris.filter(({ id }) => id !== favori.id));
  }

  private estFavori(trajet: TrajetPropose): boolean {
    return this.liste().some(
      (f) => f.type === 'trajet' && f.depart?.id === trajet.depart.id && f.arrivee.id === trajet.arrivee.id,
    );
  }

  private entetes(): HttpHeaders {
    const jeton = this.auth.token();
    if (!jeton) throw new FavorisError('NON_CONNECTE', 'Connectez-vous pour gérer vos favoris.');
    return new HttpHeaders({ Authorization: `Bearer ${jeton}` });
  }

  private async appeler<T>(requete: () => Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(requete());
    } catch (erreur) {
      throw this.versErreur(erreur);
    }
  }

  private versErreur(erreur: unknown): FavorisError {
    if (erreur instanceof FavorisError) return erreur;
    if (!(erreur instanceof HttpErrorResponse)) {
      return new FavorisError('INCONNUE', 'Une erreur est survenue. Réessayez.');
    }
    if (erreur.status === 0) {
      return new FavorisError('HORS_LIGNE', 'Serveur injoignable. Vérifiez votre connexion et réessayez.');
    }
    if (erreur.status === 401) {
      return new FavorisError('SESSION_EXPIREE', 'Votre session a expiré. Reconnectez-vous.');
    }
    const corps = erreur.error as ApiErrorBody | null;
    const code = corps?.erreur?.code ?? 'INCONNUE';
    if (code === 'FAVORI_EXISTANT') return new FavorisError(code, 'Ce trajet est déjà dans vos favoris.');
    if (erreur.status >= 500) {
      return new FavorisError(code, 'Le service est momentanément indisponible. Réessayez plus tard.');
    }
    return new FavorisError(code, corps?.erreur?.message ?? 'Une erreur est survenue. Réessayez.');
  }
}
