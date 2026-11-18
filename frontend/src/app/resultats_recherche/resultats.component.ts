import { Component, inject } from '@angular/core';
import { RechercheService } from '../core/recherche/recherche.service';

/**
 * BUS-FE-023 – Résultats de recherche.
 * Critère : « Les résultats sont lisibles et sélectionnables ».
 *
 * Chaque carte indique la ligne et la destination, puis ligne, arrêt de montée,
 * attente, marche et durée. Une estimation absente (null) affiche
 * « Estimation indisponible » : on n'invente JAMAIS de valeur.
 * Un clic sélectionne le résultat → son détail s'affiche (ticket 024).
 */
@Component({
  selector: 'app-resultats',
  standalone: true,
  templateUrl: './resultats.component.html',
  styleUrl: './resultats.component.css',
})
export class ResultatsComponent {
  readonly recherche = inject(RechercheService);

  /** « 4 min » ou « Estimation indisponible » si la valeur manque. */
  minutes(valeur: number | null): string {
    return valeur === null ? 'Estimation indisponible' : `${valeur} min`;
  }
}
