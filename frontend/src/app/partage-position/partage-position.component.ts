import { computed,  Component, inject, OnDestroy, signal } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { PartagePositionService } from './partage-position.service';

@Component({
  selector: 'app-partage-position',
  standalone: true,
  templateUrl: './partage-position.component.html',
  styleUrls: ['./partage-position.component.scss'],
})
export class PartagePositionComponent implements OnDestroy {
  private readonly service = inject(PartagePositionService);
  private readonly auth = inject(AuthService);

  readonly panneauOuvert = signal(false);
  readonly consentement = signal(false);
  readonly partageActif = signal(false);
  readonly chargement = signal(false);
  readonly message = signal('Partage désactivé.');
  readonly estConnecte = this.auth.isLoggedIn;

  readonly backendConnecte = computed(() => !!this.auth.backendToken());
  readonly connexionEnCours = signal(false);

  private sessionId: string | null = null;

  async connecterAuBackend(
    identifiant: string,
    motDePasse: string
  ): Promise<void> {
    if (!identifiant.trim() || !motDePasse || this.connexionEnCours()) {
      return;
    }

    this.connexionEnCours.set(true);

    try {
      await this.service.connecter(identifiant.trim(), motDePasse);
      this.message.set('Connexion au serveur réussie.');
    } catch {
      this.message.set('Connexion impossible. Vérifiez vos identifiants.');
    } finally {
      this.connexionEnCours.set(false);
    }
  }

  async connecterBackend(
    identifiant: string,
    motDePasse: string
  ): Promise<void> {
    await this.service.connecter(identifiant, motDePasse);
  }
  private demandeArret = false;
  private detruit = false;

  basculerPanneau(): void {
    this.panneauOuvert.update((ouvert) => !ouvert);
  }

  changerConsentement(event: Event): void {
    const coche = (event.target as HTMLInputElement).checked;

    this.consentement.set(coche);

    if (!coche) {
      this.demandeArret = true;

      if (this.partageActif()) {
        void this.arreterPartage();
      } else {
        this.message.set('Consentement retiré.');
      }
    } else {
      this.demandeArret = false;
      this.message.set('Consentement donné. Vous pouvez démarrer le partage.');
    }
  }

  async demarrerPartage(): Promise<void> {
    if (
      this.detruit ||
      !this.backendConnecte() ||
      !this.consentement() ||
      this.partageActif() ||
      this.chargement()
    ) {
      return;
    }

    this.chargement.set(true);
    this.demandeArret = false;

    try {
      const session = await this.service.demarrer();

      this.sessionId = session.id;
      this.partageActif.set(true);

      if (this.detruit || this.demandeArret || !this.consentement()) {
        await this.arreterPartage();
        return;
      }

      this.message.set('Session de partage active.');
    } catch (erreur) {
      if (!this.detruit) {
        this.message.set(this.messageErreur(erreur));
      }
    } finally {
      this.chargement.set(false);
    }
  }

  async arreterPartage(): Promise<void> {
    this.demandeArret = true;
    this.consentement.set(false);

    const id = this.sessionId;

    if (!id) {
      this.partageActif.set(false);
      this.message.set('Partage désactivé.');
      return;
    }

    this.chargement.set(true);

    try {
      await this.service.arreter(id);

      this.sessionId = null;
      this.partageActif.set(false);

      if (!this.detruit) {
        this.message.set('Partage arrêté avec succès.');
      }
    } catch (erreur) {
      if (!this.detruit) {
        this.message.set(
          `Arrêt non confirmé : ${this.messageErreur(erreur)}`,
        );
      }
    } finally {
      this.chargement.set(false);
    }
  }

  reinitialiser(): void {
    this.demandeArret = true;
    this.consentement.set(false);
    this.panneauOuvert.set(false);

    if (this.sessionId) {
      void this.arreterPartage();
    } else if (!this.chargement()) {
      this.partageActif.set(false);
      this.message.set('Partage désactivé.');
    }
  }

  ngOnDestroy(): void {
    this.detruit = true;
    this.reinitialiser();
  }

  private messageErreur(erreur: unknown): string {
    if (erreur instanceof Error && erreur.message.includes('connecté')) {
      return erreur.message;
    }

    return 'Impossible de communiquer avec le serveur. Réessayez.';
  }
}