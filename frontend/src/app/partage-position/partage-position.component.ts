import type { OnDestroy } from '@angular/core';
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-partage-position',
  standalone: true,
  templateUrl: './partage-position.component.html',
  styleUrls: ['./partage-position.component.scss'],
})
export class PartagePositionComponent implements OnDestroy {
  readonly panneauOuvert = signal(false);
  readonly consentement = signal(false);
  readonly simulationActive = signal(false);
  readonly message = signal('Partage désactivé.');

  basculerPanneau(): void {
    this.panneauOuvert.update((ouvert) => !ouvert);
  }

  changerConsentement(event: Event): void {
    const caseCochee = event.target as HTMLInputElement;

    this.consentement.set(caseCochee.checked);

    // Retirer le consentement arrête immédiatement la simulation.
    if (!caseCochee.checked) {
      this.simulationActive.set(false);
      this.message.set('Partage désactivé. Consentement retiré.');
    } else {
      this.message.set('Consentement donné. La simulation reste arrêtée tant que vous ne la démarrez pas.');
    }
  }

  demarrerSimulation(): void {
    // Vérification également dans le code, pas seulement sur le bouton.
    if (!this.consentement() || this.simulationActive()) {
      return;
    }

    this.simulationActive.set(true);
    this.message.set('Simulation active. Aucune position réelle collectée ou transmise.');
  }

  arreterSimulation(): void {
    this.simulationActive.set(false);
    this.consentement.set(false);
    this.message.set('Simulation arrêtée. Un nouveau consentement sera nécessaire pour recommencer.');
  }

  reinitialiser(): void {
    this.simulationActive.set(false);
    this.consentement.set(false);
    this.panneauOuvert.set(false);
    this.message.set('Partage désactivé.');
  }

  ngOnDestroy(): void {
    this.reinitialiser();
  }
}
