import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';

const CLE_JETON = 'kotbis.api.jeton';

function lireJeton(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(CLE_JETON);
}

export const REPORT_API_TOKEN = new InjectionToken<string | null>('REPORT_API_TOKEN', {
  providedIn: 'root',
  factory: lireJeton,
});

@Injectable({ providedIn: 'root' })
export class ApiSessionService {
  private readonly http = inject(HttpClient);
  private readonly jeton = signal<string | null>(inject(REPORT_API_TOKEN));
  readonly token = this.jeton.asReadonly();

  async obtenirJeton(): Promise<string | null> {
    const actuel = this.jeton();
    if (actuel) return actuel;
    if (typeof window === 'undefined') return null;

    const identifiant = window.prompt('Identifiant API KotBis');
    if (!identifiant) return null;
    const motDePasse = window.prompt('Mot de passe API KotBis');
    if (!motDePasse) return null;

    try {
      const reponse = await firstValueFrom(
        this.http.post<{ jeton: string }>(`${environment.apiUrl}/api/connexion`, {
          identifiant,
          motDePasse,
        }),
      );
      this.definirJeton(reponse.jeton);
      return reponse.jeton;
    } catch {
      return null;
    }
  }

  definirJeton(jeton: string): void {
    this.jeton.set(jeton);
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(CLE_JETON, jeton);
  }
}
