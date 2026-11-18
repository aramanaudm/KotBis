import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';

interface TrajetFavori {
  readonly id: number;
  readonly depart: string;
  readonly destination: string;
}

const EXEMPLES: readonly TrajetFavori[] = [
  { id: 1, depart: 'Port-Louis', destination: 'Curepipe' },
  { id: 2, depart: 'Rose-Hill', destination: 'Quatre Bornes' },
];
const CLE_FAVORIS = 'kotbis.favoris';

function lireFavoris(): number[] {
  const ids: unknown = JSON.parse(localStorage.getItem(CLE_FAVORIS) ?? '[]');
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is number => typeof id === 'number');
}

@Component({
  selector: 'app-favoris',
  templateUrl: './favoris.page.html',
  styleUrl: './favoris.page.scss',
  imports: [IonContent, RouterLink],
})
export class FavorisPage {
  readonly retour = signal<{ message: string; erreur: boolean } | null>(null);
  private readonly idsFavoris = signal<readonly number[]>([]);
  readonly favoris = computed(() => EXEMPLES.filter(({ id }) => this.idsFavoris().includes(id)));
  readonly trajetsAjoutables = computed(() => EXEMPLES.filter(({ id }) => !this.idsFavoris().includes(id)));

  constructor() {
    try {
      this.idsFavoris.set(lireFavoris());
    } catch {
      // Le stockage peut être inaccessible ou contenir des données illisibles.
    }
  }

  ajouter(favori: TrajetFavori, prochainElement: HTMLElement): void {
    try {
      const ids = [...new Set([...lireFavoris(), favori.id])];
      localStorage.setItem(CLE_FAVORIS, JSON.stringify(ids));
      this.idsFavoris.set(ids);
      this.retour.set({ message: 'Trajet enregistré dans les favoris.', erreur: false });
      prochainElement.focus();
    } catch {
      this.retour.set({ message: 'Impossible d’enregistrer ce favori. Réessayez.', erreur: true });
    }
  }

  retirer(favori: TrajetFavori, prochainElement: HTMLElement): void {
    try {
      const ids = lireFavoris().filter((id) => id !== favori.id);
      localStorage.setItem(CLE_FAVORIS, JSON.stringify(ids));
      this.idsFavoris.set(ids);
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
