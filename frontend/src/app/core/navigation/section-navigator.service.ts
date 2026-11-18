import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';

/**
 * Ouvre une section de l'application par son chemin de route (ex. `'favoris'`).
 *
 * Les écrans d'autres epics (favoris, alertes, signalements…) n'existent pas encore : tant que la
 * route n'est pas déclarée dans `app.routes.ts`, un message « bientôt » s'affiche. Dès qu'un
 * collègue ajoute la route, la navigation fonctionne sans modifier « Mon espace ».
 */
@Injectable({ providedIn: 'root' })
export class SectionNavigator {
  private readonly router = inject(Router);
  private readonly nav = inject(NavController);
  private readonly toasts = inject(ToastController);

  async open(path: string): Promise<void> {
    if (this.router.config.some((route) => route.path === path)) {
      await this.nav.navigateForward(`/${path}`);
      return;
    }
    const toast = await this.toasts.create({
      message: 'Cette section arrive bientôt.',
      duration: 1800,
      position: 'bottom',
      cssClass: 'bm-toast',
    });
    await toast.present();
  }
}
