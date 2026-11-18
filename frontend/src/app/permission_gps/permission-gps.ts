import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-permission-gps',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './permission-gps.html',
  styleUrls: ['./permission-gps.scss']
})
export class PermissionGpsComponent {
  // Récupération de la balise <dialog> du HTML
  @ViewChild('dialogueGps') dialogueGps!: ElementRef<HTMLDialogElement>;
  
  // Signal pour stocker le message à afficher
  messageResultat = signal('');

  /** Ouvre la boîte de dialogue */
  ouvrirDialogue() {
    this.dialogueGps.nativeElement.showModal();
  }

  /** Gère le clic sur "Refuser" */
  refuser() {
    this.dialogueGps.nativeElement.close();
    this.dire('Vous avez refusé la localisation. Vous pouvez choisir votre départ manuellement.');
  }

  /** Gère le clic sur "Autoriser" */
  autoriser() {
    this.dialogueGps.nativeElement.close();
    this.demanderPosition();
  }

  /** Demande la position au navigateur (votre logique JS) */
  private demanderPosition() {
    if (!('geolocation' in navigator)) {
      this.dire('La localisation n\'est pas disponible sur cet appareil. Choisissez votre départ manuellement.');
      return;
    }

    this.dire('Localisation en cours…');

    navigator.geolocation.getCurrentPosition(
      // Succès
      (pos) => {
        this.dire(`Position obtenue (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}).`);
        // TODO: Vous pouvez envoyer ces coordonnées à votre carte Leaflet ici !
      },
      // Échec
      (erreur) => {
        if (erreur.code === erreur.PERMISSION_DENIED) {
          this.dire('Localisation refusée. Vous pouvez choisir votre départ manuellement.');
        } else {
          this.dire('Position indisponible. Vous pouvez choisir votre départ manuellement.');
        }
      },
      { timeout: 10000 } // on n'attend pas plus de 10 secondes
    );
  }

  /** Met à jour le message */
  private dire(texte: string) {
    this.messageResultat.set(texte);
  }
}