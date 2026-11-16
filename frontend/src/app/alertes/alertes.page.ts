import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';

interface Alerte {
  readonly id: number;
  readonly trajet: string;
  readonly active: boolean;
  readonly heure?: string;
  readonly repetition?: string;
}

@Component({
  selector: 'app-alertes',
  templateUrl: './alertes.page.html',
  styleUrl: './alertes.page.scss',
  imports: [IonContent, RouterLink],
})
export class AlertesPage {
  readonly alertes = signal<readonly Alerte[]>([
    { id: 1, trajet: 'Port-Louis → Curepipe', active: true },
    { id: 2, trajet: 'Rose-Hill → Quatre Bornes', active: false },
  ]);
  readonly annonce = signal('');

  enregistrer(
    event: Event,
    formulaire: HTMLFormElement,
    dialogue: HTMLDialogElement,
    destination: string,
    heure: string,
    repetition: string,
  ): void {
    event.preventDefault();
    if (!formulaire.reportValidity()) return;

    this.alertes.update((alertes) => [
      ...alertes,
      { id: alertes.length + 1, trajet: 'Destination : ' + destination, active: true, heure, repetition },
    ]);
    this.annonce.set('Alerte créée pour ' + destination + '.');
    dialogue.close();
  }
}
