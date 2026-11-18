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
  template: `
    <div class="champ">
      <label for="destination">Destination</label>
      <input
        id="destination"
        type="text"
        autocomplete="off"
        placeholder="Où allez-vous ? Ex. Rose Hill"
        role="combobox"
        aria-controls="suggestions-destination"
        [attr.aria-expanded]="listeVisible()"
        [value]="texte()"
        (input)="saisir($event)"
      />

      @if (listeVisible()) {
        <ul id="suggestions-destination" role="listbox">
          @for (a of suggestions(); track a.id) {
            <li role="option" tabindex="0" (click)="choisir(a)" (keydown.enter)="choisir(a)">
              <strong>{{ a.nom }}</strong> <small>{{ a.zone }}</small>
            </li>
          } @empty {
            <li class="vide">Aucun arrêt ne correspond.</li>
          }
        </ul>
      }

      <!-- Confirme à l'usager (et aux lecteurs d'écran) quel arrêt est choisi -->
      <p role="status" aria-live="polite" class="etat">
        @if (recherche.destination(); as d) { Destination : {{ d.nom }} ({{ d.zone }}) }
      </p>
    </div>
  `,
  styles: [
    `
      .champ { display: grid; gap: 6px; margin: 10px 0; }
      label { font-weight: 700; color: #203448; }
      input {
        min-height: 44px; padding: 0 12px; border: 1px solid #c9d3dd;
        border-radius: 12px; background: #fff; color: #203448; font: inherit;
      }
      ul { margin: 0; padding: 0; list-style: none; max-height: 160px; overflow: auto;
           border: 1px solid #c9d3dd; border-radius: 12px; background: #fff; }
      li { padding: 10px 12px; cursor: pointer; color: #203448; }
      li:hover, li:focus { background: #edf3fa; }
      li small { color: #596675; margin-left: 6px; }
      li.vide { cursor: default; color: #596675; }
      .etat { margin: 0; font-size: 0.85rem; color: #596675; }
    `,
  ],
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
