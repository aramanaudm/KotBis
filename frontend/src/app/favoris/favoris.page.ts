import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';

import type { TrajetFavori } from './favoris.service';
import { FavorisService } from './favoris.service';

@Component({
  selector: 'app-favoris',
  templateUrl: './favoris.page.html',
  styleUrl: './favoris.page.scss',
  imports: [IonContent, RouterLink],
})
export class FavorisPage {
  private readonly serviceFavoris = inject(FavorisService);
  readonly retour = signal<{ message: string; erreur: boolean } | null>(null);
  readonly favoris = this.serviceFavoris.favoris;
  readonly trajetsAjoutables = this.serviceFavoris.trajetsAjoutables;

  ajouter(favori: TrajetFavori, prochainElement: HTMLElement): void {
    try {
      this.serviceFavoris.ajouter(favori.id);
      this.retour.set({ message: 'Trajet enregistré dans les favoris.', erreur: false });
      prochainElement.focus();
    } catch {
      this.retour.set({ message: 'Impossible d’enregistrer ce favori. Réessayez.', erreur: true });
    }
  }

  retirer(favori: TrajetFavori, prochainElement: HTMLElement): void {
    try {
      this.serviceFavoris.retirer(favori.id);
      this.retour.set({
        message: `Trajet de ${favori.depart} à ${favori.destination} retiré des favoris.`,
        erreur: false,
      });
      prochainElement.focus();
    } catch {
      this.retour.set({ message: 'Impossible de retirer ce favori. Réessayez.', erreur: true });
    }
  }
}
