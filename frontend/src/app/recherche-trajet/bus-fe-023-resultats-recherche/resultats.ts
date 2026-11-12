/**
 * BUS-FE-023 – Afficher les résultats de recherche
 * Critère : « Les résultats sont lisibles et sélectionnables ».
 *
 * Comme dans le prototype du cahier (Partie 3), la carte indique la ligne et la destination, puis
 * les cinq informations demandées :
 * ligne, arrêt de montée, attente, marche et durée.
 * Une estimation absente (null) affiche « Estimation indisponible » :
 * on n'invente JAMAIS de valeur.
 */

// Remarque TypeScript : « ! » après getElementById signifie « cet élément existe forcément
// dans le fichier HTML » (sinon TypeScript craint qu'il soit null).

/** Un résultat de recherche. Une estimation absente vaut null. */
interface Resultat {
  id: string;
  ligne: string;
  destination: string;
  arretMontee: string;
  attenteMin: number | null;
  marcheMin: number | null;
  dureeMin: number | null;
}

// Résultats de DÉMONSTRATION (à remplacer par la réponse du service de recherche).
const RESULTATS: Resultat[] = [
  { id: 'r1', ligne: '4A', destination: 'Rose Hill', arretMontee: 'Roches Brunes', attenteMin: 4,    marcheMin: 3, dureeMin: 18 },
  { id: 'r2', ligne: '7',  destination: 'Rose Hill', arretMontee: 'Roches Brunes', attenteMin: null, marcheMin: 5, dureeMin: 22 },
];

const liste = document.getElementById('liste-resultats') as HTMLUListElement;
const message = document.getElementById('selection') as HTMLElement;
let idSelectionne: string | null = null; // identifiant du résultat choisi

/** Texte d'une durée : « 4 min » ou « Estimation indisponible » si la valeur manque. */
function minutes(valeur: number | null): string {
  return valeur === null ? 'Estimation indisponible' : `${valeur} min`;
}

/** Sélectionne un résultat et met à jour l'affichage. */
function selectionner(resultat: Resultat): void {
  idSelectionne = resultat.id;
  message.textContent = `Trajet sélectionné : ligne ${resultat.ligne}.`;
  // aria-pressed indique aux lecteurs d'écran quel bouton est actif.
  for (const b of liste.querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(b.dataset.id === idSelectionne));
  }
  // Prévient la tâche « détail du trajet » qu'un résultat a été choisi.
  document.dispatchEvent(new CustomEvent('resultat-selectionne', { detail: resultat }));
}

/** Construit la liste à l'écran. */
function afficher(resultats: Resultat[]): void {
  liste.innerHTML = '';
  for (const r of resultats) {
    const li = document.createElement('li');
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.dataset.id = r.id;
    bouton.setAttribute('aria-pressed', 'false');
    bouton.innerHTML =
      `<strong>Ligne ${r.ligne} → ${r.destination}</strong><br>` +
      `Montée : ${r.arretMontee}<br>` +
      `Attente : ${minutes(r.attenteMin)}<br>` +
      `Marche : ${minutes(r.marcheMin)}<br>` +
      `Durée : ${minutes(r.dureeMin)}`;
    bouton.addEventListener('click', () => selectionner(r));
    li.appendChild(bouton);
    liste.appendChild(li);
  }
}

afficher(RESULTATS);
