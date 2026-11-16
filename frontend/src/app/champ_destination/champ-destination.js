/**
 * BUS-FE-019 – Créer le champ de sélection de la destination
 * Critère : « La destination peut être saisie et sélectionnée ».
 *
 * Fonctionnement :
 *  1. l'utilisateur tape des lettres ;
 *  2. la liste propose les arrêts qui correspondent (avec leur zone) ;
 *  3. un clic sur une suggestion « sélectionne » l'arrêt.
 */

// Arrêts de DÉMONSTRATION (mêmes que pour le départ ; à remplacer plus tard par les données du backend).
// Deux « Bel Air » existent exprès : la zone permet de les distinguer.
const ARRETS = [
  { id: 'A01', nom: 'Rose Hill',     zone: 'Plaines Wilhems' },
  { id: 'A02', nom: 'Roches Brunes', zone: 'Plaines Wilhems' },
  { id: 'A03', nom: 'Camp Levieux',  zone: 'Plaines Wilhems' },
  { id: 'A04', nom: 'Réduit',        zone: 'Moka' },
  { id: 'A05', nom: 'Quatre Bornes', zone: 'Plaines Wilhems' },
  { id: 'A06', nom: 'Bel Air',       zone: 'Rivière du Rempart' },
  { id: 'A07', nom: 'Bel Air',       zone: 'Flacq' },
];

// Éléments de la page
const champ = document.getElementById('destination');
const liste = document.getElementById('suggestions-destination');
const message = document.getElementById('selection-destination');

// Arrêt actuellement choisi ; null tant qu'aucune suggestion n'a été cliquée.
let destinationChoisie = null;

/** Met en minuscules et retire les accents : « reduit » trouve « Réduit ». */
function normaliser(texte) {
  return texte.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Affiche les suggestions qui correspondent au texte tapé (6 maximum). */
function afficherSuggestions() {
  const recherche = normaliser(champ.value);
  liste.innerHTML = '';

  // Texte vide : on n'affiche rien plutôt que toute la liste.
  const trouves = recherche === ''
    ? []
    : ARRETS.filter((a) => normaliser(a.nom).includes(recherche)).slice(0, 6);

  for (const arret of trouves) {
    const li = document.createElement('li');
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.setAttribute('role', 'option');
    bouton.innerHTML = `${arret.nom}<br><small>${arret.zone}</small>`;
    bouton.addEventListener('click', () => choisir(arret));
    li.appendChild(bouton);
    liste.appendChild(li);
  }

  liste.hidden = trouves.length === 0;
  champ.setAttribute('aria-expanded', String(trouves.length > 0));
}

/** Enregistre l'arrêt choisi et referme la liste. */
function choisir(arret) {
  destinationChoisie = arret;
  champ.value = `${arret.nom} (${arret.zone})`;
  message.textContent = `Destination choisie : ${arret.nom} (${arret.zone})`;
  liste.hidden = true;
  champ.setAttribute('aria-expanded', 'false');
}

// À chaque frappe, le choix précédent est annulé : l'utilisateur doit re-choisir.
// Ainsi un texte libre inconnu n'est jamais pris pour un arrêt valide.
champ.addEventListener('input', () => {
  destinationChoisie = null;
  message.textContent = '';
  afficherSuggestions();
});

/** Utilisable par les autres tâches (ex. le bouton de recherche) : arrêt choisi ou null. */
function getDestination() {
  return destinationChoisie;
}
