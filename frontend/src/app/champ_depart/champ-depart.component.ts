import { Component, computed, inject, signal } from '@angular/core';
import { GpsService } from '../core/gps/gps.service';

/** Arrêt proposé dans le choix manuel (données de DÉMONSTRATION). */
interface ArretChoix {
  id: string;
  nom: string;
  zone: string;
}

/**
 * BUS-FE-018 + BUS-FE-020 – Champ « Départ » avec repli sans GPS.
 *
 *  - GPS accordé  → affiche « Ma position » ;
 *  - GPS refusé / indisponible → affiche la liste d'arrêts à choisir à la main ;
 *  - dans les deux cas un départ est connu, donc « la recherche reste possible
 *    sans GPS » (critère du ticket FE-020).
 *
 * Le bouton de test « Simuler : GPS refusé » de la page isolée est supprimé :
 * le vrai refus du GpsService le remplace.
 */
@Component({
  selector: 'app-champ-depart',
  standalone: true,
  template: `
    <div class="champ">
      <label for="depart-select">Départ</label>

      @if (gps.etat() === 'accorde') {
        <p class="position" id="depart-position">Ma position</p>
      } @else if (gps.etat() === 'refuse' || gps.etat() === 'indisponible') {
        <select id="depart-select" (change)="choisir($event)">
          <option value="">— Choisir un arrêt —</option>
          @for (a of arrets; track a.id) {
            <option [value]="a.id" [selected]="a.id === departManuel()">
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

      <!-- Annonce aux lecteurs d'écran : résultat de la localisation + état de la recherche -->
      <p role="status" aria-live="polite" class="etat">
        {{ gps.message() }} {{ etatRecherche() }}
      </p>
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

  // Arrêts de DÉMONSTRATION. L'identifiant distingue les homonymes (« Bel Air »).
  readonly arrets: ArretChoix[] = [
    { id: 'A01', nom: 'Rose Hill', zone: 'Plaines Wilhems' },
    { id: 'A02', nom: 'Roches Brunes', zone: 'Plaines Wilhems' },
    { id: 'A05', nom: 'Quatre Bornes', zone: 'Plaines Wilhems' },
    { id: 'A06', nom: 'Bel Air', zone: 'Rivière du Rempart' },
    { id: 'A07', nom: 'Bel Air', zone: 'Flacq' },
  ];

  /** Identifiant de l'arrêt choisi à la main ('' = aucun). */
  readonly departManuel = signal('');

  /** La recherche est possible dès qu'un départ est connu (GPS ou choix manuel). */
  readonly etatRecherche = computed(() => {
    if (this.gps.etat() === 'accorde' || this.departManuel()) {
      return 'Recherche : possible.';
    }
    return this.gps.etat() === 'refuse' || this.gps.etat() === 'indisponible'
      ? 'Recherche : impossible (aucun départ).'
      : '';
  });

  choisir(event: Event): void {
    this.departManuel.set((event.target as HTMLSelectElement).value);
  }
}
