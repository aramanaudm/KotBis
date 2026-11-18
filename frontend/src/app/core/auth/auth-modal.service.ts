import { Injectable, inject } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { AuthGateModalComponent } from '../../shared/auth-modals/auth-gate-modal.component';
import { ForgotPasswordModalComponent } from '../../shared/auth-modals/forgot-password-modal.component';
import { LoginModalComponent } from '../../shared/auth-modals/login-modal.component';
import { RegisterModalComponent } from '../../shared/auth-modals/register-modal.component';
import { AuthService } from './auth.service';

export type AuthView = 'login' | 'register' | 'forgot' | 'gate';

const VIEWS: Record<AuthView, { component: unknown; cssClass: string; backdropDismiss: boolean }> = {
  login: { component: LoginModalComponent, cssClass: 'bm-auth-modal', backdropDismiss: true },
  // Longs formulaires : un tap involontaire à côté ne doit pas faire perdre la saisie.
  register: { component: RegisterModalComponent, cssClass: 'bm-auth-modal', backdropDismiss: false },
  forgot: { component: ForgotPasswordModalComponent, cssClass: 'bm-auth-modal', backdropDismiss: false },
  gate: { component: AuthGateModalComponent, cssClass: 'bm-gate-modal', backdropDismiss: true },
};

const isAuthView = (role: string | undefined): role is AuthView => !!role && role in VIEWS;

/**
 * Affiche les cartes d'authentification par-dessus l'écran courant et enchaîne les transitions
 * (connexion → inscription, mot de passe oublié → connexion…). Chaque carte se ferme avec un
 * `role` : le nom de la carte suivante, `'done'` après un succès, ou `'cancel'`.
 *
 * Toutes les méthodes résolvent `true` si un compte est connecté à la fin du parcours.
 */
@Injectable({ providedIn: 'root' })
export class AuthModalService {
  private readonly modals = inject(ModalController);
  private readonly auth = inject(AuthService);
  private running = false;

  openLogin(): Promise<boolean> {
    return this.run('login');
  }

  openRegister(): Promise<boolean> {
    return this.run('register');
  }

  openForgotPassword(): Promise<boolean> {
    return this.run('forgot');
  }

  /**
   * À appeler avant une fonctionnalité réservée aux comptes (favoris, alertes, avis…).
   * Connecté : résout `true` immédiatement. Visiteur : affiche « Un compte est nécessaire ».
   */
  async requireAccount(): Promise<boolean> {
    return this.auth.isLoggedIn() ? true : this.run('gate');
  }

  private async run(start: AuthView): Promise<boolean> {
    if (this.running) return this.auth.isLoggedIn(); // une seule pile de cartes à la fois
    this.running = true;
    try {
      let view: AuthView | null = start;
      while (view) {
        const { component, cssClass, backdropDismiss } = VIEWS[view];
        const modal = await this.modals.create({ component: component as never, cssClass, backdropDismiss });
        await modal.present();
        const { role } = await modal.onDidDismiss();
        view = isAuthView(role) ? role : null;
      }
      return this.auth.isLoggedIn();
    } finally {
      this.running = false;
    }
  }
}
