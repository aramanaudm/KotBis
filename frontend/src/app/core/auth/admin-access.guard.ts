import { inject } from '@angular/core';
import { Router, type CanMatchFn } from '@angular/router';
import { ToastController } from '@ionic/angular';

/** Message affiché quand une adresse d'administration est ouverte dans l'application voyageur. */
export const ADMIN_ACCESS_DENIED_MESSAGE =
  "Accès refusé : l'administration des signalements est réservée à l'équipe KotBis.";

/**
 * BUS-FE-053 — Interface d'administration des signalements (BF-14, DoD-A01, AC-38).
 *
 * Le traitement des signalements est réalisé dans le back-office web (`backoffice/`,
 * route `/signalements`, BF-ADM-09). L'application mobile ne contient aucun écran
 * d'administration tant que le point Q-03 n'est pas validé.
 *
 * Ce garde refuse donc toute adresse `/admin/...` ouverte dans l'application :
 * aucun écran n'est chargé, un message de refus est affiché et l'utilisateur
 * revient à l'accueil. Le rôle n'est jamais lu ni envoyé par le client (AC-21).
 */
export const adminAccessGuard: CanMatchFn = () => {
  const router = inject(Router);
  const toasts = inject(ToastController, { optional: true });

  void toasts
    ?.create({
      message: ADMIN_ACCESS_DENIED_MESSAGE,
      duration: 3000,
      position: 'bottom',
      color: 'danger',
      icon: 'lock-closed-outline',
    })
    .then((toast) => toast.present())
    .catch(() => undefined);

  return router.createUrlTree(['/home']);
};