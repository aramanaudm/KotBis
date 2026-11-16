import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';

interface Alerte {
  readonly id: number;
  readonly destination: string;
  readonly depart?: string;
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
    { id: 1, depart: 'Port-Louis', destination: 'Curepipe', active: true },
    { id: 2, depart: 'Rose-Hill', destination: 'Quatre Bornes', active: false },
  ]);
  readonly annonce = signal('');
  readonly alerteEnCours = signal<Alerte | null>(null);

  ouvrir(dialogue: HTMLDialogElement, formulaire: HTMLFormElement, alerte: Alerte | null = null): void {
    this.alerteEnCours.set(alerte);
    (formulaire.elements.namedItem('destination') as HTMLSelectElement).value = alerte?.destination ?? '';
    (formulaire.elements.namedItem('heure') as HTMLInputElement).value = alerte?.heure ?? '';
    (formulaire.elements.namedItem('repetition') as HTMLSelectElement).value = alerte?.repetition ?? '';
    dialogue.showModal();
  }

  enregistrer(event: Event, formulaire: HTMLFormElement, dialogue: HTMLDialogElement): void {
    event.preventDefault();
    if (!formulaire.reportValidity()) return;

    const donnees = new FormData(formulaire);
    const destination = String(donnees.get('destination'));
    const heure = String(donnees.get('heure'));
    const repetition = String(donnees.get('repetition'));
    const enCours = this.alerteEnCours();

    if (enCours) {
      this.alertes.update((alertes) =>
        alertes.map((alerte) => (alerte.id === enCours.id ? { ...alerte, destination, heure, repetition } : alerte)),
      );
      this.annonce.set('Alerte modifiée pour ' + destination + '.');
    } else {
      this.alertes.update((alertes) => [
        ...alertes,
        { id: alertes.length + 1, destination, active: true, heure, repetition },
      ]);
      this.annonce.set('Alerte enregistrée pour ' + destination + '. Aucune notification programmée.');
    }
    dialogue.close();
  }

  changerEtat(alerte: Alerte, active: boolean): void {
    this.alertes.update((alertes) =>
      alertes.map((element) => (element.id === alerte.id ? { ...element, active } : element)),
    );
    this.annonce.set(active ? 'Alerte réactivée.' : 'Alerte désactivée.');
  }
}
