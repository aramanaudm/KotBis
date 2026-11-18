import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { GpsService } from '../gps/gps.service';

/** Arrêt de DÉMONSTRATION. L'identifiant distingue les homonymes (« Bel Air »). */
export interface ArretChoix {
  id: string;
  nom: string;
  zone: string;
}

/**
 * État partagé de la recherche de trajet (départ, destination, validation).
 *
 * Regroupe ce qui était copié dans chaque mini-page (liste d'arrêts, choix du
 * départ et de la destination) : tous les composants lisent le même état.
 * Plus tard, la liste d'arrêts viendra du backend (table `arrets`).
 */
@Injectable({ providedIn: 'root' })
export class RechercheService {
  private readonly gps = inject(GpsService);

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

  /** true quand le panneau « Départ / Destination » est affiché. */
  readonly ouvert = signal(false);

  /** Départ choisi à la main dans la liste (null = aucun). */
  readonly departManuel = signal<ArretChoix | null>(null);

  /** Destination choisie (null = aucune). */
  readonly destination = signal<ArretChoix | null>(null);

  /** true une fois le choix confirmé avec le bouton « Valider ». */
  readonly valide = signal(false);

  /** Départ effectif : la position GPS si elle est utilisée, sinon l'arrêt choisi à la main. */
  readonly depart = computed<'position' | ArretChoix | null>(() =>
    this.gps.etat() === 'accorde' ? 'position' : this.departManuel(),
  );

  /** Texte du départ, pour les messages (« Ma position » ou le nom de l'arrêt). */
  readonly libelleDepart = computed(() => {
    const d = this.depart();
    return d === 'position' ? 'Ma position' : (d?.nom ?? '');
  });

  /** Message d'erreur si le choix est incohérent (même arrêt au départ et à l'arrivée). */
  readonly erreur = computed(() => {
    const d = this.depart();
    const a = this.destination();
    return d && d !== 'position' && a && d.id === a.id
      ? 'Le départ et la destination doivent être différents.'
      : '';
  });

  /** « Valider » n'est possible que si départ ET destination sont choisis et différents. */
  readonly peutValider = computed(
    () => !!this.depart() && !!this.destination() && !this.erreur(),
  );

  constructor() {
    // Si l'usager change le départ ou la destination, la validation précédente tombe.
    effect(() => {
      this.depart();
      this.destination();
      untracked(() => this.valide.set(false));
    });
  }

  ouvrir(): void {
    this.ouvert.set(true);
  }

  fermer(): void {
    this.ouvert.set(false);
  }

  /** Confirme le choix (la recherche des bus viendra se brancher ici). */
  valider(): void {
    if (this.peutValider()) {
      this.valide.set(true);
    }
  }
}
