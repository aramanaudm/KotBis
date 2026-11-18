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
  template: `
    @if (gps.dialogueOuvert()) {
      <div class="fond" (keydown.escape)="gps.refuser()">
        <section
          class="boite"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-gps"
        >
          <h2 id="titre-gps">Utiliser votre position ?</h2>
          <p>
            Elle sert uniquement à trouver l'arrêt le plus proche. Elle n'est pas
            partagée avec les autres usagers.
          </p>
          <div class="actions">
            <button type="button" (click)="gps.refuser()">Refuser</button>
            <button type="button" class="principal" (click)="gps.autoriser()" autofocus>
              Autoriser
            </button>
          </div>
        </section>
      </div>
    }
  `,
  styles: [
    `
      .fond {
        position: fixed;
        inset: 0;
        z-index: 2000;
        display: grid;
        place-items: center;
        background: rgb(22 44 62 / 45%);
      }
      .boite {
        width: min(90vw, 380px);
        padding: 20px;
        border-radius: 18px;
        background: #fff;
        color: #203448;
        box-shadow: 0 8px 28px rgb(22 44 62 / 30%);
      }
      h2 { margin: 0 0 8px; font-size: 1.2rem; }
      p { margin: 0 0 16px; color: #596675; }
      .actions { display: flex; gap: 10px; justify-content: flex-end; }
      button {
        min-height: 44px;
        padding: 0 18px;
        border: 1px solid #c9d3dd;
        border-radius: 12px;
        background: #fff;
        color: #203448;
        font-weight: 700;
        cursor: pointer;
      }
      button.principal { border-color: #008060; background: #008060; color: #fff; }
    `,
  ],
})
export class GpsDialogComponent {
  /** Public pour être lu directement dans le template. */
  readonly gps = inject(GpsService);
}
