import { Component, computed, inject, signal } from '@angular/core';
import { RechercheService, ArretChoix } from '../core/recherche/recherche.service';

/**
 * BUS-FE-019 – Champ « Destination ».
 * Critère : « La destination peut être saisie et sélectionnée ».
 *
 *  1. l'usager tape des lettres ;
 *  2. la liste propose les arrêts qui correspondent (avec leur zone) ;
 *  3. un clic sur une suggestion sélectionne l'arrêt (stocké dans RechercheService).
 */
@Component({
  selector: 'app-champ-destination',
  standalone: true,
  templateUrl: './champ-destination.component.html',
  styleUrl: './champ-destination.component.css',
})
export class ChampDestinationComponent {
  readonly recherche = inject(RechercheService);

  /** Texte tapé dans le champ. */
  readonly texte = signal('');

  /** La liste est visible tant qu'on tape et qu'aucun arrêt n'est encore choisi. */
  private readonly enSaisie = signal(false);

  /** Arrêts dont le nom contient le texte (sans tenir compte des majuscules/accents). */
  readonly suggestions = computed(() => {
    const q = normaliser(this.texte());
    return this.recherche.arrets.filter((a) => normaliser(a.nom).includes(q));
  });

  readonly listeVisible = computed(() => this.enSaisie() && this.texte().trim() !== '');

  saisir(event: Event): void {
    this.texte.set((event.target as HTMLInputElement).value);
    this.recherche.destination.set(null); // l'ancien choix n'est plus valable
    this.enSaisie.set(true);
  }

  choisir(arret: ArretChoix): void {
    this.recherche.destination.set(arret);
    this.texte.set(arret.nom);
    this.enSaisie.set(false);
  }
}

/** Minuscules + sans accents, pour que « reduit » trouve « Réduit ». */
function normaliser(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
