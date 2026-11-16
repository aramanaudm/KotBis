import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  signal,
} from '@angular/core';
import * as L from 'leaflet';

interface ArretDemo {
  id: number;
  nom: string;
  position: L.LatLngTuple;
  direction?: string;
  informations?: string;
}

interface BusDemo {
  id: number;
  nom: string;
  position: L.LatLngTuple;
  numero?: string | null;
  ligne?: string | null;
  direction?: string | null;
  etat?: string | null;
}

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  @ViewChild('ficheTitre')
  private ficheTitre?: ElementRef<HTMLHeadingElement>;

  readonly carteIndisponible = signal(false);
  readonly arretSelectionne = signal<ArretDemo | null>(null);
  readonly busSelectionne = signal<BusDemo | null>(null);

  private map?: L.Map;
  private tiles?: L.TileLayer;
  private marqueurSelectionne?: L.Marker;
  private focusTimer?: ReturnType<typeof setTimeout>;

  private readonly centre: L.LatLngTuple = [-20.233, 57.467];

  // Arrêts entièrement fictifs pour la démonstration.
  private readonly arretsDemo: ArretDemo[] = [
    {
      id: 1,
      nom: 'Arrêt démo A',
      position: [-20.229, 57.463],
      direction: 'Vers le terminus démo Nord',
      informations: 'Point de départ du parcours de démonstration.',
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

  // Bus entièrement fictifs pour tester l’affichage.
  // Les champs manquants ne sont pas complétés automatiquement.
  private readonly busDemo: BusDemo[] = [
    {
      id: 1,
      nom: 'Bus démo 1',
      position: [-20.232, 57.461],
      numero: 'DEMO-001',
      ligne: 'Ligne démo A',
      direction: 'Vers le terminus démo Nord',
      etat: 'En service — simulation',
    },
    {
      id: 2,
      nom: 'Bus démo 2',
      position: [-20.234, 57.469],
      numero: 'DEMO-002',
      ligne: 'Ligne démo B',
      // Direction et état non renseignés.
    },
    {
      id: 3,
      nom: 'Bus démo 3',
      position: [-20.238, 57.472],
      // Numéro, ligne, direction et état non renseignés.
    },
  ];

  ionViewDidEnter(): void {
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
    clearTimeout(this.focusTimer);
    this.map?.remove();
    this.map = undefined;
    this.tiles = undefined;
    this.marqueurSelectionne = undefined;
  }
}