import { Component, computed, input, signal } from '@angular/core';
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
  readonly etat = input<string>();
  readonly vue = input<string>();
  readonly trajet = input<string>();
  readonly trajetsDisponibles = EXEMPLES;
  readonly favorisRetires = signal<readonly number[]>([]);
  readonly annonce = signal('');
  readonly retour = signal<{ message: string; erreur: boolean } | null>(null);
  private readonly favorisEnregistres = signal<readonly number[]>([]);
  readonly favoris = computed(() =>
    EXEMPLES.filter(
      ({ id }) =>
        this.favorisEnregistres().includes(id) || (this.etat() === 'liste' && !this.favorisRetires().includes(id)),
    ),
  );
  readonly trajetSelectionne = computed(() => EXEMPLES.find((favori) => String(favori.id) === this.trajet()));

  constructor() {
    try {
      this.favorisEnregistres.set(lireFavoris());
    } catch {
      // Le stockage peut être inaccessible ou contenir des données illisibles.
    }
  }

  ajouter(favori: TrajetFavori): void {
    try {
      const ids = [...new Set([...lireFavoris(), favori.id])];
      localStorage.setItem(CLE_FAVORIS, JSON.stringify(ids));
      this.favorisEnregistres.set(ids);
      this.retour.set({ message: 'Trajet enregistré dans les favoris.', erreur: false });
    } catch {
      this.retour.set({ message: 'Impossible d’enregistrer ce favori. Réessayez.', erreur: true });
    }
  }

  retirer(favori: TrajetFavori, prochainElement: HTMLElement): void {
    if (this.favorisEnregistres().includes(favori.id)) {
      try {
        const ids = lireFavoris().filter((id) => id !== favori.id);
        localStorage.setItem(CLE_FAVORIS, JSON.stringify(ids));
        this.favorisEnregistres.set(ids);
      } catch {
        this.retour.set({ message: 'Impossible de retirer ce favori. Réessayez.', erreur: true });
        return;
      }
    }
    this.retour.set(null);
    this.favorisRetires.update((ids) => [...ids, favori.id]);
    this.annonce.set(`Trajet de ${favori.depart} à ${favori.destination} retiré des favoris.`);
    prochainElement.focus();
  }

  reinitialiser(): void {
    this.favorisRetires.set([]);
    this.annonce.set('');
    this.retour.set(null);
  }
}
