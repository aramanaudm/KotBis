import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular';

/**
 * BUS-FE-053 : écran préparé, sans fonction de traitement.
 * Le développement du traitement commence après validation du périmètre (point Q-03) :
 * l'interface administrative relève-t-elle de cette application ou du dossier backoffice ?
 */
@Component({
  selector: 'app-admin-signalements',
  templateUrl: './admin-signalements.page.html',
  styleUrl: './admin-signalements.page.scss',
  imports: [IonContent],
})
export class AdminSignalementsPage {
  readonly statuts = ['À vérifier', 'Confirmé', 'Classé sans suite'] as const;
}