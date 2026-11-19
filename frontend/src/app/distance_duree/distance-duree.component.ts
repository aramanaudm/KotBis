import { Component, computed, input } from '@angular/core';

/**
 * BUS-FE-026 – Distance et durée estimées.
 * Critère : « Aucune valeur n'est inventée ».
 *
 * On affiche UNIQUEMENT ce que le service fournit. Si une valeur est absente
 * (null), on le dit clairement au lieu de calculer ou deviner un chiffre.
 */
@Component({
  selector: 'app-distance-duree',
  standalone: true,
  templateUrl: './distance-duree.component.html',
  styleUrl: './distance-duree.component.css',
})
export class DistanceDureeComponent {
  readonly distanceKm = input<number | null>(null);
  readonly dureeMin = input<number | null>(null);

  /** Distance avec virgule décimale à la française, ou signalement de l'absence. */
  readonly distanceTexte = computed(() => {
    const km = this.distanceKm();
    return km === null
      ? 'Distance indisponible'
      : `${km.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
  });

  readonly dureeTexte = computed(() => {
    const min = this.dureeMin();
    return min === null ? 'Estimation indisponible' : `${min} min`;
  });
}
