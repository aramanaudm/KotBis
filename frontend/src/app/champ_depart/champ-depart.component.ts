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
  templateUrl: './champ-depart.component.html',
  styleUrl: './champ-depart.component.css',
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
