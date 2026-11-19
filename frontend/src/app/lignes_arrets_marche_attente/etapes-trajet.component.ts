import { Component, input } from '@angular/core';
import type { Etape } from '../core/recherche/recherche.service';

/**
 * BUS-FE-025 – Lignes, arrêts, marche et attente estimées.
 * Critère : « Les étapes sont dans un ordre compréhensible ».
 *
 * Ordre logique : marcher → attendre et monter → rouler → descendre.
 * Chaque étape est précédée d'un mot-clé (pas seulement d'une icône ou d'une
 * couleur), et une durée absente affiche « Estimation indisponible ».
 */
@Component({
  selector: 'app-etapes-trajet',
  standalone: true,
  templateUrl: './etapes-trajet.component.html',
  styleUrl: './etapes-trajet.component.css',
})
export class EtapesTrajetComponent {
  readonly etapes = input.required<Etape[]>();
}
