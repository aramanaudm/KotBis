/**
 * BUS-FE-025 – Afficher lignes, arrêts, marche et attente estimées
 * Critère : « Les étapes sont dans un ordre compréhensible ».
 *
 * Ordre logique : marcher -> attendre et monter -> rouler -> descendre.
 * Chaque étape est précédée d'un mot-clé (pas seulement d'une icône ou d'une
 * couleur), et une durée absente affiche « Estimation indisponible ».
 */

// Remarque TypeScript : « ! » après getElementById signifie « cet élément existe forcément
// dans le fichier HTML » (sinon TypeScript craint qu'il soit null).

/** Une étape du trajet. `dureeMin` vaut null si l'estimation manque. */
interface Etape {
  type: string;
  texte: string;
  dureeMin: number | null;
  sansDuree?: boolean;   // vrai pour la descente : pas de durée à afficher
}

// Étapes de DÉMONSTRATION (viendront du service de recherche).
const ETAPES: Etape[] = [
  { type: 'Marche',    texte: 'Aller à l\'arrêt Roches Brunes',      dureeMin: 3 },
  { type: 'Attente',   texte: 'Attendre le bus ligne 4A',            dureeMin: null },
  { type: 'Bus',       texte: 'Rester à bord jusqu\'à Rose Hill',    dureeMin: 18 },
  { type: 'Descente',  texte: 'Descendre à Rose Hill',               dureeMin: null, sansDuree: true },
];

const liste = document.getElementById('etapes') as HTMLOListElement;

for (const etape of ETAPES) {
  const li = document.createElement('li');
  li.innerHTML = `<strong>${etape.type} :</strong> ${etape.texte}`;

  // La descente n'a pas de durée : on n'affiche rien plutôt qu'une valeur inventée.
  if (!etape.sansDuree) {
    const duree = document.createElement('span');
    duree.className = 'duree';
    duree.textContent = etape.dureeMin === null
      ? 'Estimation indisponible'
      : `${etape.dureeMin} min`;
    li.appendChild(duree);
  }
  liste.appendChild(li);
}
