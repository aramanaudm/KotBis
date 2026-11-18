import { NavController } from '@ionic/angular';
import { AuthService } from '../core/auth/auth.service';
import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  signal,
  inject,
} from '@angular/core';
import * as L from 'leaflet';
import { RouterLink, RouterOutlet } from '@angular/router';
import { PartagePositionComponent } from '../partage-position/partage-position.component';

interface ArretDemo {
  id: number;
  nom: string;
  position: L.LatLngTuple;
  direction?: string;
  informations?: string;
  miseAJour?: string | null;
  source?: string | null;
}

interface BusDemo {
  id: number;
  nom: string;
  position: L.LatLngTuple;
  numero?: string | null;
  ligne?: string | null;
  direction?: string | null;
  etat?: string | null;
  miseAJour?: string | null;
  source?: string | null;
}

type EtatFraicheur = 'recente' | 'ancienne' | 'inconnue';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [PartagePositionComponent, RouterLink, RouterOutlet],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnDestroy {
  readonly user = inject(AuthService).user;
  private readonly nav = inject(NavController);

  mySpace(): Promise<boolean> {
    return this.nav.navigateForward('/mon-espace');
  }

  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  @ViewChild('ficheTitre')
  private ficheTitre?: ElementRef<HTMLHeadingElement>;

  @ViewChild(PartagePositionComponent)
  private partagePosition?: PartagePositionComponent;

  readonly carteIndisponible = signal(false);
  readonly arretSelectionne = signal<ArretDemo | null>(null);
  readonly busSelectionne = signal<BusDemo | null>(null);
  readonly maintenant = signal(Date.now());

  // Seuil proposé pour la démonstration, à valider.
  private readonly seuilAncienneteMs = 15 * 60 * 1000;

  private map?: L.Map;
  private tiles?: L.TileLayer;
  private marqueurSelectionne?: L.Marker;
  private focusTimer?: ReturnType<typeof setTimeout>;
  private horloge?: ReturnType<typeof setInterval>;

  private readonly centre: L.LatLngTuple = [-20.233, 57.467];

  private readonly formatDateMaurice = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Indian/Mauritius',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Toutes les données renseignées sont fictives.
  // Les dates sont fixes : elles ne représentent pas un suivi réel.
  private readonly arretsDemo: ArretDemo[] = [
    {
      id: 1,
      nom: 'Arrêt démo A',
      position: [-20.229, 57.463],
      direction: 'Vers le terminus démo Nord',
      informations: 'Point de départ du parcours de démonstration.',
      miseAJour: '2026-11-16T10:00:00+04:00',
      source: 'Jeu de données fictives KotBis',
    },
    {
      id: 2,
      nom: 'Arrêt démo B',
      position: [-20.231, 57.47],
      direction: 'Vers le terminus démo Sud',
      informations: 'Arrêt intermédiaire du parcours de démonstration.',
    },
    {
      id: 3,
      nom: 'Arrêt démo C',
      position: [-20.237, 57.464],
      direction: 'Vers le terminus démo Nord',
    },
    {
      id: 4,
      nom: 'Arrêt démo D',
      position: [-20.235, 57.474],
    },
  ];

  // Les champs absents restent absents.
  private readonly busDemo: BusDemo[] = [
    {
      id: 1,
      nom: 'Bus démo 1',
      position: [-20.232, 57.461],
      numero: 'DEMO-001',
      ligne: 'Ligne démo A',
      direction: 'Vers le terminus démo Nord',
      etat: 'En service — simulation',
      miseAJour: '2026-11-16T10:00:00+04:00',
      source: 'Jeu de données fictives KotBis',
    },
    {
      id: 2,
      nom: 'Bus démo 2',
      position: [-20.234, 57.469],
      numero: 'DEMO-002',
      ligne: 'Ligne démo B',
    },
    {
      id: 3,
      nom: 'Bus démo 3',
      position: [-20.238, 57.472],
    },
  ];

  ionViewDidEnter(): void {
    this.demarrerHorloge();

    if (this.map) {
      this.map.invalidateSize();
      return;
    }

    this.map = L.map(this.mapContainer.nativeElement, {
      center: this.centre,
      zoom: 14,
      zoomControl: false,
    });

    this.tiles = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    );

    this.tiles.on('tileerror', () => {
      this.carteIndisponible.set(true);
    });

    this.tiles.addTo(this.map);
    this.afficherArrets();
    this.afficherBus();
    this.map.invalidateSize();
  }

  ionViewDidLeave(): void {
    this.arreterHorloge();
    clearTimeout(this.focusTimer);

    // Arrête la simulation et retire le consentement en quittant la page.
    this.partagePosition?.reinitialiser();
  }

  private demarrerHorloge(): void {
    this.maintenant.set(Date.now());

    if (this.horloge !== undefined) {
      return;
    }

    // Actualise le calcul de l’âge, pas les données elles-mêmes.
    this.horloge = setInterval(() => {
      this.maintenant.set(Date.now());
    }, 30_000);
  }

  private arreterHorloge(): void {
    clearInterval(this.horloge);
    this.horloge = undefined;
  }

  private donnerFocusFiche(): void {
    clearTimeout(this.focusTimer);

    this.focusTimer = setTimeout(() => {
      this.ficheTitre?.nativeElement.focus();
    }, 0);
  }

  private afficherArrets(): void {
    if (!this.map) {
      return;
    }

    const iconeArret = L.divIcon({
      className: 'mobis-stop-marker',
      html: '<span class="mobis-stop-dot" aria-hidden="true"></span>',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    for (const arret of this.arretsDemo) {
      const marqueur = L.marker(arret.position, {
        icon: iconeArret,
        title: `${arret.nom} — ouvrir la fiche de démonstration`,
        alt: `${arret.nom} — position fictive`,
        keyboard: true,
        riseOnHover: true,
      }).addTo(this.map);

      marqueur.on('click', () => {
        this.maintenant.set(Date.now());
        this.map?.closePopup();
        this.busSelectionne.set(null);
        this.arretSelectionne.set(arret);
        this.marqueurSelectionne = marqueur;
        this.donnerFocusFiche();
      });
    }
  }

  private afficherBus(): void {
    if (!this.map) {
      return;
    }

    const iconeBus = L.divIcon({
      className: 'kotbis-bus-marker',
      html: `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <rect x="5" y="3" width="14" height="16" rx="3" />
          <path d="M9 6h6" />
          <rect x="7.5" y="8" width="9" height="5" rx="1" />
          <path d="M3 9v4M21 9v4M7 19v2M17 19v2" />
          <circle
            cx="8.5"
            cy="16"
            r=".8"
            fill="#ffffff"
            stroke="none"
          />
          <circle
            cx="15.5"
            cy="16"
            r=".8"
            fill="#ffffff"
            stroke="none"
          />
        </svg>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22],
    });

    for (const bus of this.busDemo) {
      const marqueur = L.marker(bus.position, {
        icon: iconeBus,
        title: `${bus.nom} — ouvrir la fiche de démonstration`,
        alt: `${bus.nom} — position fictive`,
        keyboard: true,
        riseOnHover: true,
      }).addTo(this.map);

      marqueur.on('click', () => {
        this.maintenant.set(Date.now());
        this.map?.closePopup();
        this.arretSelectionne.set(null);
        this.busSelectionne.set(bus);
        this.marqueurSelectionne = marqueur;
        this.donnerFocusFiche();
      });
    }
  }

  fermerFiche(): void {
    clearTimeout(this.focusTimer);
    this.arretSelectionne.set(null);
    this.busSelectionne.set(null);
    this.marqueurSelectionne?.getElement()?.focus();
    this.marqueurSelectionne = undefined;
  }

  etatFraicheur(valeur?: string | null): EtatFraicheur {
    const texte = valeur?.trim();

    if (!texte) {
      return 'inconnue';
    }

    const horodatage = new Date(texte).getTime();

    if (!Number.isFinite(horodatage)) {
      return 'inconnue';
    }

    const age = this.maintenant() - horodatage;

    if (age < 0) {
      return 'inconnue';
    }

    return age >= this.seuilAncienneteMs ? 'ancienne' : 'recente';
  }

  libelleFraicheur(valeur?: string | null): string {
    switch (this.etatFraicheur(valeur)) {
      case 'ancienne':
        return 'Données anciennes — pas de suivi en temps réel';
      case 'recente':
        return 'Données récentes — temps réel non garanti';
      default:
        return 'Fraîcheur inconnue — date absente, invalide ou future';
    }
  }

  formaterDate(valeur?: string | null): string {
    const texte = valeur?.trim();

    if (!texte) {
      return 'Non disponible';
    }

    const date = new Date(texte);

    if (Number.isNaN(date.getTime())) {
      return 'Date non valide';
    }

    return this.formatDateMaurice.format(date);
  }

  zoomer(): void {
    this.map?.zoomIn();
  }

  dezoomer(): void {
    this.map?.zoomOut();
  }

  recentrer(): void {
    this.map?.setView(this.centre, 14);
  }

  reessayer(): void {
    this.carteIndisponible.set(false);
    this.tiles?.redraw();
  }

  ngOnDestroy(): void {
    this.arreterHorloge();
    clearTimeout(this.focusTimer);
    this.map?.remove();
    this.map = undefined;
    this.tiles = undefined;
    this.marqueurSelectionne = undefined;
  }
}
