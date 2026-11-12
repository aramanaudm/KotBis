/**
 * BUS-FE-026 – Afficher distance et durée estimées
 * Critère : « Aucune valeur n'est inventée ».
 *
 * On affiche UNIQUEMENT ce que le service fournit. Si une valeur est absente
 * (null), on le dit clairement au lieu de calculer ou deviner un chiffre.
 */

// Remarque TypeScript : « ! » après getElementById signifie « cet élément existe forcément
// dans le fichier HTML » (sinon TypeScript craint qu'il soit null).

/** Formate une distance (virgule décimale à la française) ou signale son absence. */
function formaterDistance(km: number | null | undefined): string {
  if (km === null || km === undefined) {
    return 'Distance indisponible';
  }
  return `${km.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

/** Formate une durée en minutes ou signale son absence. */
function formaterDuree(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) {
    return 'Estimation indisponible';
  }
  return `${minutes} min`;
}

/** Valeurs fournies par le service (null = absente). */
interface Trajet {
  distanceKm: number | null;
  dureeMin: number | null;
}

/** Affiche les deux valeurs reçues du service. */
function afficher(trajet: Trajet): void {
  document.getElementById('distance')!.textContent = formaterDistance(trajet.distanceKm);
  document.getElementById('duree')!.textContent = formaterDuree(trajet.dureeMin);
}

// Cas de test.
document.getElementById('avec-valeurs')!.addEventListener('click', () => afficher({ distanceKm: 6.2, dureeMin: 18 }));
document.getElementById('sans-valeurs')!.addEventListener('click', () => afficher({ distanceKm: null, dureeMin: null }));

afficher({ distanceKm: 6.2, dureeMin: 18 }); // affichage initial
