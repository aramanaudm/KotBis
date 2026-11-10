/**
 * BUS-FE-022 – Créer le bouton de recherche de trajet
 * Critère : « Le bouton lance la recherche si les champs sont valides ».
 *
 * Règles :
 *  - départ ET destination obligatoires, et différents ;
 *  - une saisie invalide affiche un message par champ et NE lance rien ;
 *  - pendant la recherche le bouton est désactivé (pas de doublons).
 */

const ARRETS = [
  { id: 'A01', nom: 'Rose Hill' },
  { id: 'A02', nom: 'Roches Brunes' },
  { id: 'A03', nom: 'Camp Levieux' },
];

const depart = document.getElementById('depart');
const destination = document.getElementById('destination');
const bouton = document.getElementById('rechercher');
const statut = document.getElementById('statut');

// Remplit les deux listes avec les arrêts de démonstration.
for (const liste of [depart, destination]) {
  for (const a of ARRETS) {
    liste.add(new Option(a.nom, a.id));
  }
}

/** Vérifie les champs ; affiche les erreurs ; retourne true si tout est valide. */
function valider() {
  const erreurDepart = depart.value ? '' : 'Choisissez un départ.';
  let erreurDestination = destination.value ? '' : 'Choisissez une destination.';
  if (!erreurDestination && depart.value === destination.value) {
    erreurDestination = 'Le départ et la destination doivent être différents.';
  }
  document.getElementById('erreur-depart').textContent = erreurDepart;
  document.getElementById('erreur-destination').textContent = erreurDestination;
  return !erreurDepart && !erreurDestination;
}

/** Simule l'appel au serveur (600 ms). À remplacer par le vrai appel d'API. */
function appelerService(idDepart, idDestination) {
  return new Promise((resolve) => setTimeout(() => resolve({ idDepart, idDestination }), 600));
}

bouton.addEventListener('click', async () => {
  if (!valider()) {
    return; // saisie invalide : aucune requête n'est envoyée
  }
  bouton.disabled = true; // empêche un second clic pendant le chargement
  statut.textContent = 'Recherche en cours…';
  try {
    const reponse = await appelerService(depart.value, destination.value);
    // On prévient les autres parties de la page (résultats, détail…).
    document.dispatchEvent(new CustomEvent('recherche-lancee', { detail: reponse }));
    statut.textContent = 'Recherche terminée.';
  } finally {
    bouton.disabled = false; // le bouton est toujours réactivé, même en cas d'échec
  }
});
