import { Injectable, signal } from '@angular/core';

/**
 * Service commun de localisation GPS (tickets BUS-FE-018, BUS-FE-020, BUS-FE-021).
 *
 * Il remplace la logique qui était dans permission_gps/permission-gps.ts :
 * un seul endroit demande la position, et tous les composants (bouton ◎ de la
 * carte, champ « Départ ») lisent le même état grâce aux « signals » Angular.
 *
 * Règle importante : un refus ou une panne ne bloque JAMAIS l'application.
 * L'état passe simplement à « refuse » ou « indisponible », et le champ Départ
 * propose alors le choix manuel d'un arrêt.
 */

/** inconnu = jamais demandé · accorde = position obtenue · refuse = l'usager a dit non
 *  · indisponible = pas de GPS sur l'appareil, délai dépassé ou autre panne. */
export type EtatGps = 'inconnu' | 'enCours' | 'accorde' | 'refuse' | 'indisponible';

export interface PositionGps {
  latitude: number;
  longitude: number;
}

@Injectable({ providedIn: 'root' })
export class GpsService {
  /** État courant de la localisation. */
  readonly etat = signal<EtatGps>('inconnu');

  /** Dernière position obtenue (null tant qu'aucune n'est connue). */
  readonly position = signal<PositionGps | null>(null);

  /** true quand notre boîte « Utiliser votre position ? » est affichée. */
  readonly dialogueOuvert = signal(false);

  /** Message lisible, annoncé aux lecteurs d'écran (role="status"). */
  readonly message = signal('');

  /** Étape 1 : on explique d'abord POURQUOI on veut la position. */
  ouvrirDialogue(): void {
    this.dialogueOuvert.set(true);
  }

  /** L'usager refuse dans NOTRE boîte : on n'appelle pas le navigateur. */
  refuser(): void {
    this.dialogueOuvert.set(false);
    this.etat.set('refuse');
    this.message.set(
      'Vous avez refusé la localisation. Vous pouvez choisir votre départ manuellement.',
    );
  }

  /** L'usager autorise dans notre boîte : étape 2, le navigateur demande à son tour. */
  autoriser(): void {
    this.dialogueOuvert.set(false);
    this.demanderPosition();
  }

  /** Demande la position au navigateur et traduit chaque issue en état clair. */
  demanderPosition(): void {
    // Cas : l'appareil n'a pas de GPS (ou le navigateur ne le propose pas).
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      this.etat.set('indisponible');
      this.message.set(
        "La localisation n'est pas disponible sur cet appareil. Choisissez votre départ manuellement.",
      );
      return;
    }

    this.etat.set('enCours');
    this.message.set('Localisation en cours…');

    navigator.geolocation.getCurrentPosition(
      // Succès : l'usager a accepté dans le navigateur.
      (pos) => {
        this.position.set({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        this.etat.set('accorde');
        this.message.set('Position obtenue.');
      },
      // Échec : refus (code 1) ou autre cause (panne, délai dépassé…).
      (erreur) => {
        if (erreur.code === erreur.PERMISSION_DENIED) {
          this.etat.set('refuse');
          this.message.set(
            'Localisation refusée. Vous pouvez choisir votre départ manuellement.',
          );
        } else {
          this.etat.set('indisponible');
          this.message.set(
            'Position indisponible. Vous pouvez choisir votre départ manuellement.',
          );
        }
      },
      { timeout: 10_000 }, // on n'attend pas plus de 10 secondes
    );
  }
}
