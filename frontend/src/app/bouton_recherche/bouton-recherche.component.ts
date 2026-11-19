import { Component, inject } from '@angular/core';
import { RechercheService } from '../core/recherche/recherche.service';

/**
 * BUS-FE-022 – Bouton de recherche de trajet.
 * Critère : « Le bouton lance la recherche si les champs sont valides ».
 *
 * Règles :
 *  - départ ET destination obligatoires, et différents ;
 *  - une saisie invalide affiche un message par champ et NE lance rien ;
 *  - pendant la recherche le bouton est désactivé (pas de doublons).
 * La validation et l'appel au service sont dans RechercheService.rechercher().
 */
@Component({
  selector: 'app-bouton-recherche',
  standalone: true,
  templateUrl: './bouton-recherche.component.html',
  styleUrl: './bouton-recherche.component.css',
})
export class BoutonRechercheComponent {
  readonly recherche = inject(RechercheService);
}
