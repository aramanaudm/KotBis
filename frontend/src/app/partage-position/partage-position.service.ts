import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';

export interface SessionPartage {
  id: string;
  compteId: string;
  dateDebut: string;
  dateFin: string | null;
  dateExpiration: string;
  statut: 'active' | 'arretee' | 'expiree';
}

interface ReponsePartage {
  success: boolean;
  message: string;
  data: SessionPartage;
}

@Injectable({ providedIn: 'root' })
export class PartagePositionService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = 'http://localhost:3000/api';
  private jeton: string | null = null;

  async connecter(identifiant: string, motDePasse: string): Promise<void> {
    const reponse = await firstValueFrom(
      this.http.post<{ jeton: string }>(`${this.api}/connexion`, {
        identifiant,
        motDePasse,
      }),
    );

    if (!reponse.jeton) {
      throw new Error('Aucun jeton reçu du serveur.');
    }

    this.jeton = reponse.jeton;
  }

  private headers(): HttpHeaders {
    const token = this.auth.backendToken() || this.jeton;

    if (!token) {
      throw new Error('Connexion au serveur obligatoire.');
    }

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  async demarrer(): Promise<SessionPartage> {
    const reponse = await firstValueFrom(
      this.http.post<ReponsePartage>(
        `${this.api}/localisation/partage/demarrer`,
        { consentement: true },
        { headers: this.headers() },
      ),
    );

    return reponse.data;
  }

  async arreter(sessionId: string): Promise<SessionPartage> {
    const reponse = await firstValueFrom(
      this.http.post<ReponsePartage>(
        `${this.api}/localisation/partage/arreter`,
        { sessionId },
        { headers: this.headers() },
      ),
    );

    return reponse.data;
  }

  async deconnecter(): Promise<void> {
    if (!this.jeton) return;

    try {
      await firstValueFrom(
        this.http.post(
          `${this.api}/deconnexion`,
          {},
          { headers: this.headers() },
        ),
      );
    } finally {
      this.jeton = null;
    }
  }
}
