/**
 * BUS-FE-024 – Afficher le détail d'un trajet
 * Critère : « Le détail correspond au résultat sélectionné ».
 *
 * Le panneau est TOUJOURS reconstruit à partir du résultat reçu : il ne garde
 * aucune ancienne valeur, donc on ne voit jamais le détail d'un autre trajet.
 * (Le contenu détaillé : étapes = tâche 025, distance/durée = tâche 026.)
 */

// Deux résultats de DÉMONSTRATION pour tester le changement de sélection.
const RESULTATS = [
  { id: 'r1', ligne: '4A', immatriculation: '1234 AB 21', etat: 'En service', depart: 'Roches Brunes', destination: 'Rose Hill' },
  { id: 'r2', ligne: '7',  immatriculation: '3456 GH 22', etat: null, depart: 'Roches Brunes', destination: 'Rose Hill' },
];

const panneau = document.getElementById('detail');
const titre = document.getElementById('detail-titre');
const contenu = document.getElementById('detail-contenu');

/** Affiche le détail du résultat passé en paramètre. */
function afficherDetail(resultat) {
  titre.textContent = `Ligne ${resultat.ligne}`;
  contenu.textContent =
    `De ${resultat.depart} à ${resultat.destination} — bus immatriculé ${resultat.immatriculation}.`;
  // État du bus (ex. « En service ») : si la donnée manque on le dit, on n'invente rien.
  document.getElementById('detail-etat').textContent =
    `État du bus : ${resultat.etat ?? 'indisponible'}`;
  panneau.hidden = false;
  titre.setAttribute('tabindex', '-1');
  titre.focus(); // place le focus sur le titre pour les lecteurs d'écran
}

/** Ferme le panneau. */
document.getElementById('fermer').addEventListener('click', () => { panneau.hidden = true; });

// Écoute l'événement émis par la liste des résultats (tâche 023).
document.addEventListener('resultat-selectionne', (e) => afficherDetail(e.detail));

// Boutons de test (à supprimer une fois relié à la vraie liste).
const zoneTest = document.getElementById('choix-test');
for (const r of RESULTATS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = `Choisir la ligne ${r.ligne}`;
  b.addEventListener('click', () => afficherDetail(r));
  zoneTest.appendChild(b);
}
