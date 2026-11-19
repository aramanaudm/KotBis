import { Component, computed, inject, input } from '@angular/core';
import { AuthModalService } from '../core/auth/auth-modal.service';
import type { EtatRecherche } from '../core/recherche/recherche.service';

/** Les situations affichables ici (pas « repos » ni « resultats »). */
type EtatMessage = Exclude<EtatRecherche, 'repos' | 'resultats'>;

/** Contenu d'un message : icône + titre + explication SANS détail technique. */
interface Message {
  icone: string;
  titre: string;
  detail: string;
}

const MESSAGES: Record<EtatMessage, Message> = {
  chargement: { icone: '⏳', titre: 'Recherche en cours…', detail: 'Merci de patienter quelques instants.' },
  vide: { icone: '🔍', titre: 'Aucun bus direct trouvé', detail: 'Essayez un autre départ ou une autre destination.' },
  quota: {
    icone: '🔒',
    titre: 'Limite de recherches atteinte',
    detail:
      'Vous avez utilisé vos 10 recherches de visiteur. Connectez-vous pour plus de fonctionnalités. La carte et les détails restent consultables.',
  },
  reseau: { icone: '📡', titre: 'Connexion impossible', detail: 'Vérifiez votre connexion internet puis réessayez.' },
  serveur: { icone: '⚠', titre: 'Service momentanément indisponible', detail: 'Un problème est survenu de notre côté. Réessayez dans un instant.' },
};

/**
 * BUS-FE-027 – Absence de résultat, quota atteint et erreurs.
 * Critère : « Chaque situation affiche un message compréhensible ».
 *
 * L'icône ET le texte sont toujours affichés ensemble : on ne se repose jamais
 * sur la couleur seule. Seul le quota propose « Se connecter ».
 */
@Component({
  selector: 'app-etats-recherche',
  standalone: true,
  templateUrl: './etats-recherche.component.html',
  styleUrl: './etats-recherche.component.css',
})
export class EtatsRechercheComponent {
  readonly auth = inject(AuthModalService);

  /** Situation à afficher (donnée par la page). */
  readonly etat = input.required<EtatRecherche>();

  /** Message de la situation (par sécurité, « serveur » si l'état n'est pas un cas d'erreur). */
  readonly message = computed(() => MESSAGES[this.etat() as EtatMessage] ?? MESSAGES.serveur);
}
