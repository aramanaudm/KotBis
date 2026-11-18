import { computed, Injectable, signal } from '@angular/core';

export interface TrajetFavori {
  readonly id: number;
  readonly depart: string;
  readonly destination: string;
}

const EXEMPLES: readonly TrajetFavori[] = [
  { id: 1, depart: 'Port-Louis', destination: 'Curepipe' },
  { id: 2, depart: 'Rose-Hill', destination: 'Quatre Bornes' },
];
const CLE_FAVORIS = 'kotbis.favoris';

@Injectable({ providedIn: 'root' })
export class FavorisService {
  private readonly ids = signal<readonly number[]>([]);
  readonly favoris = computed(() => EXEMPLES.filter(({ id }) => this.ids().includes(id)));
  readonly trajetsAjoutables = computed(() => EXEMPLES.filter(({ id }) => !this.ids().includes(id)));

  constructor() {
    try {
      this.ids.set(this.lire());
    } catch {
      // La liste reste vide si le stockage navigateur est inaccessible ou illisible.
    }
  }

  ajouter(id: number): void {
    this.enregistrer([...new Set([...this.lire(), id])]);
  }

  retirer(id: number): void {
    this.enregistrer(this.lire().filter((favori) => favori !== id));
  }

  private lire(): number[] {
    const ids: unknown = JSON.parse(localStorage.getItem(CLE_FAVORIS) ?? '[]');
    if (!Array.isArray(ids)) return [];
    return ids.filter((id): id is number => typeof id === 'number');
  }

  private enregistrer(ids: number[]): void {
    localStorage.setItem(CLE_FAVORIS, JSON.stringify(ids));
    this.ids.set(ids);
  }
}
