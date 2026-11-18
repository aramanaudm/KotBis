import { Component, inject } from '@angular/core';
import { IonIcon, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline, lockClosedOutline } from 'ionicons/icons';

/**
 * « Un compte est nécessaire » : affiché quand un visiteur touche une fonctionnalité réservée
 * aux comptes (voir AuthModalService.requireAccount).
 */
@Component({
  selector: 'app-auth-gate-modal',
  imports: [IonIcon],
  styles: `
    :host {
      display: block;
    }
    .gate {
      position: relative;
      padding: 68px 26px 26px;
      background: var(--bm-bg);
      color: var(--bm-ink);
    }
    .close {
      position: absolute;
      top: 24px;
      right: 25px;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--bm-ink);
      font-size: 24px;
      cursor: pointer;
    }
    h2 {
      margin: 16px 0 0;
      font-size: 22px;
      line-height: 26px;
      font-weight: 700;
    }
    p {
      margin: 10px 0 22px;
      font-size: 13px;
      line-height: 20px;
      color: var(--bm-muted);
    }
    .links {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 2px;
    }
    .links .bm-btn {
      width: auto;
      min-height: 44px;
    }
  `,
  template: `
    <div class="gate">
      <button class="close" type="button" aria-label="Fermer" (click)="dismiss('cancel')">
        <ion-icon name="close-outline"></ion-icon>
      </button>

      <span class="bm-tile"><ion-icon name="lock-closed-outline"></ion-icon></span>
      <h2>Un compte est nécessaire</h2>
      <p>Connectez-vous ou créez un compte pour continuer avec cette fonctionnalité.</p>

      <button class="bm-btn bm-btn--blue bm-btn--lg" type="button" (click)="dismiss('login')">Se connecter</button>
      <div class="links">
        <button class="bm-btn bm-btn--link" type="button" (click)="dismiss('register')">Créer un compte</button>
        <button class="bm-btn bm-btn--link" type="button" (click)="dismiss('cancel')">Continuer la visite</button>
      </div>
    </div>
  `,
})
export class AuthGateModalComponent {
  private readonly modals = inject(ModalController);

  constructor() {
    addIcons({ closeOutline, lockClosedOutline });
  }

  protected dismiss(role: 'cancel' | 'login' | 'register'): Promise<boolean> {
    return this.modals.dismiss(null, role);
  }
}
