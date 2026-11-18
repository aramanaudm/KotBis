import { Component, inject } from '@angular/core';
import { GpsService } from '../core/gps/gps.service';
import { RechercheService } from '../core/recherche/recherche.service';

/**
 * BUS-FE-018 + BUS-FE-020 – Champ « Départ » avec repli sans GPS.
 *
 *  - GPS accordé  → affiche « Ma position » + un bouton pour ANNULER son utilisation ;
 *  - sinon        → affiche la liste d'arrêts à choisir à la main
 *                   (+ bouton « Utiliser ma position »).
 *  - dans les deux cas un départ est connu, donc « la recherche reste possible
 *    sans GPS » (critère du ticket FE-020).
 *
 * Le départ choisi à la main est stocké dans RechercheService (partagé avec
 * le bouton « Valider »).
 */
@Component({
  selector: 'app-champ-depart',
  standalone: true,
  template: `
    <div class="champ">
      <label for="depart-select">Départ</label>

      @if (gps.etat() === 'accorde') {
        <div class="position-ligne">
          <p class="position" id="depart-position">Ma position</p>
          <button
            type="button"
            class="annuler"
            (click)="gps.annuler()"
            aria-label="Annuler l'utilisation de ma position"
          >
            Annuler
          </button>
        </div>
      } @else {
        <select id="depart-select" (change)="choisir($event)">
          <option value="">— Choisir un arrêt —</option>
          @for (a of recherche.arrets; track a.id) {
            <option [value]="a.id" [selected]="a.id === recherche.departManuel()?.id">
              {{ a.nom }} ({{ a.zone }})
            </option>
          }
        </select>
      }

      @if (gps.etat() !== 'accorde' && gps.etat() !== 'enCours') {
        <button type="button" class="gps" (click)="gps.ouvrirDialogue()">
          Utiliser ma position
        </button>
      }

      <!-- Annonce aux lecteurs d'écran : résultat de la localisation -->
      <p role="status" aria-live="polite" class="etat">{{ gps.message() }}</p>
    </div>
  `,
  styles: [
    `
      .champ { display: grid; gap: 6px; margin: 10px 0; }
      label { font-weight: 700; color: #203448; }
      select, .position {
        min-height: 44px; margin: 0; padding: 0 12px;
        border: 1px solid #c9d3dd; border-radius: 12px;
        display: flex; align-items: center; background: #fff; color: #203448;
      }
      .position-ligne { display: flex; gap: 8px; }
      .position-ligne .position { flex: 1; }
      .annuler {
        min-height: 44px; padding: 0 14px; border: 1px solid #c9d3dd;
        border-radius: 12px; background: #fff; color: #b3261e;
        font-weight: 700; cursor: pointer;
      }
      .gps {
        min-height: 44px; border: 1px solid #008060; border-radius: 12px;
        background: #fff; color: #008060; font-weight: 700; cursor: pointer;
      }
      .etat { margin: 0; font-size: 0.85rem; color: #596675; }
    `,
  ],
})
export class ChampDepartComponent {
  readonly gps = inject(GpsService);
  readonly recherche = inject(RechercheService);

  /** Mémorise l'arrêt choisi à la main (null si « Choisir un arrêt »). */
  choisir(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.recherche.departManuel.set(this.recherche.arrets.find((a) => a.id === id) ?? null);
  }
}
