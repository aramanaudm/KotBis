import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { GpsService } from '../gps/gps.service';

/** Arrêt de DÉMONSTRATION. L'identifiant distingue les homonymes (« Bel Air »). */
export interface ArretChoix {
  id: string;
  nom: string;
  zone: string;
}

/** Une étape du trajet (ticket 025). `dureeMin` vaut null si l'estimation manque. */
export interface Etape {
  type: 'Marche' | 'Attente' | 'Bus' | 'Descente';
  texte: string;
  dureeMin: number | null;
  sansDuree?: boolean; // vrai pour la descente : pas de durée à afficher
}

/**
 * Un résultat de recherche (tickets 023 à 026).
 * RÈGLE : une valeur absente vaut null et s'affiche « indisponible » — on n'invente JAMAIS de valeur.
 */
export interface Resultat {
  id: string;
  ligne: string;
  depart: string;
  destination: string;
  arretMontee: string;
  immatriculation: string;
  etat: string | null;
  attenteMin: number | null;
  marcheMin: number | null;
  dureeMin: number | null;
  distanceKm: number | null;
  etapes: Etape[];
}

/**
 * Situations de la recherche (ticket 027) :
 * repos = on saisit · chargement · resultats · vide · quota · reseau · serveur.
 */
export type EtatRecherche =
  | 'repos'
  | 'chargement'
  | 'resultats'
  | 'vide'
  | 'quota'
  | 'reseau'
  | 'serveur';

/** Nombre de recherches autorisées à un visiteur (non connecté). */
const QUOTA_VISITEUR = 10;
const CLE_COMPTEUR = 'bus-search-count';

/** Lignes de DÉMONSTRATION. À remplacer par la réponse du backend (tables lignes / trajets / arrets). */
const LIGNES_DEMO = [
  { ligne: '4A', vers: 'Rose Hill', montee: 'Roches Brunes', attente: 4, marche: 3, duree: 18, km: 6.2, plaque: '1234 AB 21', etat: 'En service' },
  { ligne: '7', vers: 'Rose Hill', montee: 'Roches Brunes', attente: null, marche: 5, duree: 22, km: null, plaque: '3456 GH 22', etat: null },
  { ligne: '12', vers: 'Camp Levieux', montee: 'Rose Hill', attente: 7, marche: 3, duree: 24, km: 8.4, plaque: '3752 JN 21', etat: 'En service' },
  { ligne: '4A', vers: 'Roches Brunes', montee: 'Camp Levieux', attente: 12, marche: 4, duree: 16, km: 5.1, plaque: '4916 AP 20', etat: 'En service' },
];

/**
 * État partagé de la recherche de trajet : champs (départ, destination), lancement,
 * résultats, détail et situations d'erreur. Tous les composants lisent le même état.
 */
@Injectable({ providedIn: 'root' })
export class RechercheService {
  private readonly gps = inject(GpsService);
  private readonly auth = inject(AuthService);

  /** Arrêts de démonstration (à remplacer par les données du backend). */
  readonly arrets: ArretChoix[] = [
    { id: 'A01', nom: 'Rose Hill', zone: 'Plaines Wilhems' },
    { id: 'A02', nom: 'Roches Brunes', zone: 'Plaines Wilhems' },
    { id: 'A03', nom: 'Camp Levieux', zone: 'Plaines Wilhems' },
    { id: 'A04', nom: 'Réduit', zone: 'Moka' },
    { id: 'A05', nom: 'Quatre Bornes', zone: 'Plaines Wilhems' },
    { id: 'A06', nom: 'Bel Air', zone: 'Rivière du Rempart' },
    { id: 'A07', nom: 'Bel Air', zone: 'Flacq' },
  ];

  /** true quand le panneau « Votre trajet » est affiché. */
  readonly ouvert = signal(false);

  /** Départ choisi à la main dans la liste (null = aucun). */
  readonly departManuel = signal<ArretChoix | null>(null);

  /** Destination choisie (null = aucune). */
  readonly destination = signal<ArretChoix | null>(null);

  /** Situation courante de la recherche. */
  readonly etat = signal<EtatRecherche>('repos');

  /** Résultats de la dernière recherche. */
  readonly resultats = signal<Resultat[]>([]);

  /** Résultat sélectionné dans la liste (null = aucun) → affiche son détail. */
  readonly resultatChoisi = signal<Resultat | null>(null);

  /** true après un clic sur le bouton : les messages d'erreur des champs deviennent visibles. */
  readonly tentative = signal(false);

  /** Départ effectif : la position GPS si elle est utilisée, sinon l'arrêt choisi à la main. */
  readonly depart = computed<'position' | ArretChoix | null>(() =>
    this.gps.etat() === 'accorde' ? 'position' : this.departManuel(),
  );

  /** Texte du départ, pour les messages (« Ma position » ou le nom de l'arrêt). */
  readonly libelleDepart = computed(() => {
    const d = this.depart();
    return d === 'position' ? 'Ma position' : (d?.nom ?? '');
  });

  /** Messages d'erreur par champ (ticket 022) — visibles seulement après un clic. */
  readonly erreurDepart = computed(() =>
    this.tentative() && !this.depart() ? 'Choisissez un départ.' : '',
  );

  readonly erreurDestination = computed(() => {
    if (!this.tentative()) {
      return '';
    }
    const d = this.depart();
    const a = this.destination();
    if (!a) {
      return 'Choisissez une destination.';
    }
    return d && d !== 'position' && d.id === a.id
      ? 'Le départ et la destination doivent être différents.'
      : '';
  });

  /** Les champs sont valides : départ ET destination choisis, et différents. */
  readonly champsValides = computed(() => {
    const d = this.depart();
    const a = this.destination();
    return !!d && !!a && !(d !== 'position' && d.id === a.id);
  });

  /** Nombre de recherches déjà faites par ce visiteur (gardé le temps de la session). */
  readonly compteur = signal(lireCompteur());

  /** Visiteur = personne de connectée. */
  private get visiteur(): boolean {
    return !this.auth.isLoggedIn();
  }

  ouvrir(): void {
    this.ouvert.set(true);
  }

  /** Ferme le panneau et remet la recherche à zéro. */
  fermer(): void {
    this.ouvert.set(false);
    this.modifier();
  }

  /** Retour à la saisie (garde le départ et la destination choisis). */
  modifier(): void {
    this.etat.set('repos');
    this.resultats.set([]);
    this.resultatChoisi.set(null);
    this.tentative.set(false);
  }

  /**
   * BUS-FE-022 – Lance la recherche SI les champs sont valides.
   * Saisie invalide → on affiche les messages et on ne lance rien.
   * Pendant la recherche, le bouton est désactivé (etat = 'chargement').
   */
  async rechercher(): Promise<void> {
    this.tentative.set(true);
    if (!this.champsValides() || this.etat() === 'chargement') {
      return;
    }

    // BUS-FE-027 – quota : 10 recherches pour un visiteur.
    if (this.visiteur && this.compteur() >= QUOTA_VISITEUR) {
      this.etat.set('quota');
      return;
    }

    this.etat.set('chargement');
    this.resultatChoisi.set(null);
    try {
      const resultats = await this.appelerService();
      if (this.visiteur) {
        this.compteur.update((n) => n + 1);
        ecrireCompteur(this.compteur());
      }
      this.resultats.set(resultats);
      this.etat.set(resultats.length ? 'resultats' : 'vide');
    } catch (erreur) {
      // Pas de détail technique affiché : seulement « réseau » ou « serveur ».
      this.etat.set(typeof navigator !== 'undefined' && !navigator.onLine ? 'reseau' : 'serveur');
      console.error(erreur);
    }
  }

  /** BUS-FE-023 – sélectionne un résultat (→ ticket 024 : son détail). */
  choisir(resultat: Resultat): void {
    this.resultatChoisi.set(resultat);
  }

  /** Ferme le détail et revient à la liste des résultats. */
  fermerDetail(): void {
    this.resultatChoisi.set(null);
  }

  /**
   * Simule l'appel au serveur (600 ms). À REMPLACER par le vrai appel d'API :
   * toutes les valeurs ci-dessous sont des données de démonstration.
   */
  private appelerService(): Promise<Resultat[]> {
    const destination = this.destination();
    const depart = this.libelleDepart();
    return new Promise<Resultat[]>((resolve) => {
      setTimeout(() => {
        const trouves = LIGNES_DEMO.filter((l) => l.vers === destination?.nom);
        resolve(
          trouves.map((l, i) => ({
            id: `r${i + 1}`,
            ligne: l.ligne,
            depart,
            destination: l.vers,
            arretMontee: l.montee,
            immatriculation: l.plaque,
            etat: l.etat,
            attenteMin: l.attente,
            marcheMin: l.marche,
            dureeMin: l.duree,
            distanceKm: l.km,
            // BUS-FE-025 – ordre logique : marcher → attendre → rouler → descendre.
            etapes: [
              { type: 'Marche', texte: `Aller à l'arrêt ${l.montee}`, dureeMin: l.marche },
              { type: 'Attente', texte: `Attendre le bus ligne ${l.ligne}`, dureeMin: l.attente },
              { type: 'Bus', texte: `Rester à bord jusqu'à ${l.vers}`, dureeMin: l.duree },
              { type: 'Descente', texte: `Descendre à ${l.vers}`, dureeMin: null, sansDuree: true },
            ],
          })),
        );
      }, 600);
    });
  }
}

/** Lit le compteur de recherches de la session (0 si le stockage est indisponible). */
function lireCompteur(): number {
  try {
    return Number(sessionStorage.getItem(CLE_COMPTEUR) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function ecrireCompteur(n: number): void {
  try {
    sessionStorage.setItem(CLE_COMPTEUR, String(n));
  } catch {
    /* stockage indisponible : on garde le compteur en mémoire seulement */
  }
}
