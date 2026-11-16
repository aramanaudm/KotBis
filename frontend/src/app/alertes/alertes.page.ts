import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';

interface Alerte {
  readonly id: number;
  readonly trajet: string;
  readonly active: boolean;
}

@Component({
  selector: 'app-alertes',
  templateUrl: './alertes.page.html',
  styleUrl: './alertes.page.scss',
  imports: [IonContent, RouterLink],
})
export class AlertesPage {
  readonly alertes: readonly Alerte[] = [
    { id: 1, trajet: 'Port-Louis → Curepipe', active: true },
    { id: 2, trajet: 'Rose-Hill → Quatre Bornes', active: false },
  ];
}
