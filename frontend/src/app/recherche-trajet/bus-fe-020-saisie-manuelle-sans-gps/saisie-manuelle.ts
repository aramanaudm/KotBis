/**
 * BUS-FE-020 – Permettre la saisie manuelle sans GPS
 * Critère : « La recherche reste possible sans GPS ».
 *
 * Idée : quand le GPS est refusé, on affiche un choix manuel du départ.
 * Dès qu'un départ manuel est choisi, la recherche est de nouveau permise.
 */

// Remarque TypeScript : « ! » après getElementById signifie « cet élément existe forcément
// dans le fichier HTML » (sinon TypeScript craint qu'il soit null).

/** Un arrêt de bus. */
interface Arret {
  id: string;
  nom: string;
  zone: string;
}

// Arrêts de DÉMONSTRATION.
const ARRETS: Arret[] = [
  { id: 'A01', nom: 'Rose Hill',     zone: 'Plaines Wilhems' },
  { id: 'A02', nom: 'Roches Brunes', zone: 'Plaines Wilhems' },
  { id: 'A05', nom: 'Quatre Bornes', zone: 'Plaines Wilhems' },
  { id: 'A06', nom: 'Bel Air',       zone: 'Rivière du Rempart' },
  { id: 'A07', nom: 'Bel Air',       zone: 'Flacq' },
];

const blocManuel = document.getElementById('bloc-manuel') as HTMLElement;
const selection = document.getElementById('depart-manuel') as HTMLSelectElement;
const etat = document.getElementById('etat-recherche') as HTMLElement;

// Remplit la liste déroulante. L'identifiant est la valeur : il distingue les homonymes.
for (const a of ARRETS) {
  const option = document.createElement('option');
  option.value = a.id;
  option.textContent = `${a.nom} (${a.zone})`;
  selection.appendChild(option);
}

/** À appeler quand le GPS est refusé / indisponible : montre le choix manuel. */
function activerSaisieManuelle(): void {
  blocManuel.hidden = false;
  selection.focus(); // amène directement le clavier / lecteur d'écran sur le champ
}

/** Met à jour le message : la recherche est possible dès qu'un départ est choisi. */
function mettreAJourEtat(): void {
  etat.textContent = selection.value
    ? 'Recherche : possible (départ manuel choisi).'
    : 'Recherche : impossible (aucun départ).';
}

document.getElementById('simuler-refus')!.addEventListener('click', activerSaisieManuelle);
selection.addEventListener('change', mettreAJourEtat);
