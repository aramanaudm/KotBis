/**
 * BUS-FE-027 – Afficher absence de résultat, quota atteint et erreurs
 * Critère : « Chaque situation affiche un message compréhensible ».
 *
 * Un dictionnaire associe chaque situation à une icône, un titre et une
 * explication SANS détail technique. L'icône ET le texte sont toujours
 * affichés ensemble : on ne se repose jamais sur la couleur seule.
 */

// Remarque TypeScript : « ! » après getElementById signifie « cet élément existe forcément
// dans le fichier HTML » (sinon TypeScript craint qu'il soit null).

/** Les situations possibles de la recherche. */
type Etat = 'chargement' | 'vide' | 'quota' | 'reseau' | 'serveur';

/** Contenu d'un message : icône + titre + explication. */
interface Message {
  icone: string;
  titre: string;
  detail: string;
}

const MESSAGES: Record<Etat, Message> = {
  chargement: { icone: '⏳', titre: 'Recherche en cours…',               detail: 'Merci de patienter quelques instants.' },
  vide:       { icone: '🔍', titre: 'Aucun bus direct trouvé',           detail: 'Essayez un autre départ ou une autre destination.' },
  quota:      { icone: '🔒', titre: 'Limite de recherches atteinte',     detail: 'Vous avez utilisé vos 10 recherches de visiteur. Connectez-vous pour plus de fonctionnalités. La carte et les détails restent consultables.' },
  reseau:     { icone: '📡', titre: 'Connexion impossible',              detail: 'Vérifiez votre connexion internet puis réessayez.' },
  serveur:    { icone: '⚠',  titre: 'Service momentanément indisponible', detail: 'Un problème est survenu de notre côté. Réessayez dans un instant.' },
};

// Noms lisibles pour les boutons de test.
const NOMS_TEST: Record<Etat, string> = {
  chargement: 'Chargement', vide: 'Aucun résultat', quota: 'Quota atteint',
  reseau: 'Erreur réseau', serveur: 'Erreur serveur',
};

/** Affiche le message correspondant à la situation donnée. */
function afficherEtat(etat: Etat): void {
  const m = MESSAGES[etat];
  document.getElementById('message-icone')!.textContent = m.icone;
  document.getElementById('message-titre')!.textContent = m.titre;
  document.getElementById('message-detail')!.textContent = m.detail;
  // Seul le quota propose de se connecter (comme l'écran de connexion des maquettes).
  document.getElementById('message-action')!.hidden = etat !== 'quota';
}

// Crée un bouton de test par situation.
const zoneTests = document.getElementById('tests') as HTMLElement;
for (const etat of Object.keys(MESSAGES) as Etat[]) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = NOMS_TEST[etat];
  b.addEventListener('click', () => afficherEtat(etat));
  zoneTests.appendChild(b);
}

afficherEtat('vide'); // affichage initial
