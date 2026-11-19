import { Component, inject } from '@angular/core';
import { GpsService } from '../core/gps/gps.service';

/**
 * BUS-FE-021 – Boîte de dialogue « Utiliser votre position ? ».
 *
 * Affichée quand l'usager appuie sur le bouton ◎ de la carte ou sur
 * « Utiliser ma position » du champ Départ. Elle explique pourquoi on demande la
 * position ; Autoriser déclenche ensuite la demande du navigateur.
 * L'état est porté par GpsService : ce composant n'a aucune logique propre.
 */
@Component({
  selector: 'app-gps-dialog',
  standalone: true,
  templateUrl: './gps-dialog.component.html',
  styleUrl: './gps-dialog.component.css',
})
export class GpsDialogComponent {
  /** Public pour être lu directement dans le template. */
  readonly gps = inject(GpsService);
}
