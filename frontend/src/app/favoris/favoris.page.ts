import { Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';

import { AuthModalService } from '../core/auth/auth-modal.service';
import { AuthService } from '../core/auth/auth.service';

import type { ArretFavori, Favori, TrajetPropose } from './favoris.service';
import { FavorisError, FavorisService } from './favoris.service';

@Component({
  selector: 'app-favoris',
  templateUrl: './favoris.page.html',
  styleUrl: './favoris.page.scss',
  imports: [IonContent, RouterLink],
})
export class FavorisPage {
  private readonly serviceFavoris = inject(FavorisService);
  private readonly auth = inject(AuthService);
  private readonly authModals = inject(AuthModalService);

  readonly connecte = this.auth.isLoggedIn;
  readonly retour = signal<{ message: string; erreur: boolean } | null>(null);
  readonly enCours = signal(false);
  readonly recherche = signal('');
  readonly favoris = this.serviceFavoris.favoris;
  readonly trajetsAjoutables = this.serviceFavoris.trajetsAjoutables;

  constructor() {
    // À l'ouverture (et après connexion) : favoris à jour et premiers trajets proposés.
    effect(() => {
      if (!this.connecte()) return;
      untracked(() => void this.actualiser());
    });
  }

  nomArret(arret: ArretFavori | null): string {
    return arret?.nom ?? 'Arrêt supprimé';
  }

  intitule(favori: Favori): string {
    return favori.depart
      ? `${this.nomArret(favori.depart)} → ${this.nomArret(favori.arrivee)}`
      : `Vers ${this.nomArret(favori.arrivee)}`;
  }

  async seConnecter(): Promise<void> {
    await this.authModals.openLogin();
  }

  async rechercher(evenement: Event): Promise<void> {
    evenement.preventDefault();
    await this.executer(() => this.serviceFavoris.rechercherTrajets(this.recherche()));
  }

  async ajouter(trajet: TrajetPropose, prochainElement: HTMLElement): Promise<void> {
    const ok = await this.executer(() => this.serviceFavoris.ajouter(trajet));
    if (!ok) return;
    this.retour.set({ message: 'Trajet enregistré dans les favoris.', erreur: false });
    prochainElement.focus();
  }

  async retirer(favori: Favori, prochainElement: HTMLElement): Promise<void> {
    const ok = await this.executer(() => this.serviceFavoris.retirer(favori));
    if (!ok) return;
    this.retour.set({ message: `Trajet ${this.intitule(favori)} retiré des favoris.`, erreur: false });
    prochainElement.focus();
  }

  private async actualiser(): Promise<void> {
    await this.executer(() =>
      Promise.all([this.serviceFavoris.charger(), this.serviceFavoris.rechercherTrajets(this.recherche())]),
    );
  }

  /** Une seule opération à la fois ; l'erreur de l'API est affichée telle quelle. */
  private async executer(action: () => Promise<unknown>): Promise<boolean> {
    if (this.enCours()) return false;
    this.enCours.set(true);
    try {
      await action();
      return true;
    } catch (erreur) {
      const message = erreur instanceof FavorisError ? erreur.message : 'Une erreur est survenue. Réessayez.';
      this.retour.set({ message, erreur: true });
      return false;
    } finally {
      this.enCours.set(false);
    }
  }
}
