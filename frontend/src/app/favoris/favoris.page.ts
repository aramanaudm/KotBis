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
  readonly favorisRetires = signal<readonly number[]>([]);
  readonly annonce = signal('');
  readonly favoris = computed(() =>
    this.etat() === 'liste' ? EXEMPLES.filter((favori) => !this.favorisRetires().includes(favori.id)) : [],
  );
  readonly trajetSelectionne = computed(() => EXEMPLES.find((favori) => String(favori.id) === this.trajet()));

  retirer(favori: TrajetFavori, prochainElement: HTMLElement): void {
    this.favorisRetires.update((ids) => [...ids, favori.id]);
    this.annonce.set(`Trajet de ${favori.depart} à ${favori.destination} retiré des favoris.`);
    prochainElement.focus();
  }

  reinitialiser(): void {
    this.favorisRetires.set([]);
    this.annonce.set('');
  }
}
