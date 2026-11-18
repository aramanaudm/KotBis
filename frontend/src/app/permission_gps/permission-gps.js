/**
 * BUS-FE-021 – Ajouter la demande de permission GPS
 * Critère : « L'utilisateur peut accepter ou refuser ».
 *
 * Parcours en deux temps :
 *  1. notre propre boîte de dialogue explique pourquoi (Autoriser / Refuser) ;
 *  2. si l'utilisateur autorise, le navigateur affiche à son tour sa demande.
 * Un refus (à l'un ou l'autre moment) ne bloque jamais l'application.
 */

const bouton = document.getElementById('utiliser-position');
const dialogue = document.getElementById('dialogue-gps');
const resultat = document.getElementById('resultat-gps');

/** Affiche le message de résultat. */
function dire(texte) {
  resultat.textContent = texte;
}

/** Demande la position au navigateur et traduit chaque issue en message clair. */
function demanderPosition() {
  // Cas : l'appareil n'a pas de GPS.
  if (!('geolocation' in navigator)) {
    dire('La localisation n\'est pas disponible sur cet appareil. Choisissez votre départ manuellement.');
    return;
  }
  dire('Localisation en cours…');
  navigator.geolocation.getCurrentPosition(
    // Succès : l'utilisateur a accepté.
    (pos) => dire(`Position obtenue (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}).`),
    // Échec : refus (code 1) ou autre cause (panne, délai dépassé…).
    (erreur) => dire(erreur.code === erreur.PERMISSION_DENIED
      ? 'Localisation refusée. Vous pouvez choisir votre départ manuellement.'
      : 'Position indisponible. Vous pouvez choisir votre départ manuellement.'),
    { timeout: 10000 } // on n'attend pas plus de 10 secondes
  );
}

bouton.addEventListener('click', () => dialogue.showModal());

document.getElementById('refuser').addEventListener('click', () => {
  dialogue.close();
  dire('Vous avez refusé la localisation. Vous pouvez choisir votre départ manuellement.');
});

document.getElementById('autoriser').addEventListener('click', () => {
  dialogue.close();
  demanderPosition();
});
