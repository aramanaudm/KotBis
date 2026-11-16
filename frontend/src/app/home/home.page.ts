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
}

interface BusDemo {
  id: number;
  nom: string;
  position: L.LatLngTuple;
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

  readonly carteIndisponible = signal(false);

  private map?: L.Map;
  private tiles?: L.TileLayer;

  private readonly centre: L.LatLngTuple = [-20.233, 57.467];

  // Positions fictives, sans lien avec des arrêts officiels.
  private readonly arretsDemo: ArretDemo[] = [
    { id: 1, nom: 'Arrêt démo A', position: [-20.229, 57.463] },
    { id: 2, nom: 'Arrêt démo B', position: [-20.231, 57.47] },
    { id: 3, nom: 'Arrêt démo C', position: [-20.237, 57.464] },
    { id: 4, nom: 'Arrêt démo D', position: [-20.235, 57.474] },
  ];

  // Bus fictifs : aucune position réelle ou mise à jour en direct.
  private readonly busDemo: BusDemo[] = [
    { id: 1, nom: 'Bus démo 1', position: [-20.232, 57.461] },
    { id: 2, nom: 'Bus démo 2', position: [-20.234, 57.469] },
    { id: 3, nom: 'Bus démo 3', position: [-20.238, 57.472] },
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

  private afficherArrets(): void {
    if (!this.map) {
      return;
    }

    const iconeArret = L.divIcon({
      className: 'mobis-stop-marker',
      html: '<span class="mobis-stop-dot" aria-hidden="true"></span>',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -12],
    });

    for (const arret of this.arretsDemo) {
      const contenu = document.createElement('div');
      const titre = document.createElement('strong');
      titre.textContent = arret.nom;

      const description = document.createElement('p');
      description.textContent = 'Démonstration — position fictive.';

      contenu.append(titre, description);

      L.marker(arret.position, {
        icon: iconeArret,
        title: `${arret.nom} — Démonstration`,
        alt: `${arret.nom} — position fictive`,
        keyboard: true,
        riseOnHover: true,
      })
        .addTo(this.map)
        .bindPopup(contenu);
    }
  }

  private afficherBus(): void {
    if (!this.map) {
      return;
    }

    const iconeBus = L.divIcon({
      className: 'kotbis-bus-marker',
      html: '<span class="kotbis-bus-symbol" aria-hidden="true">🚌</span>',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22],
    });

    for (const bus of this.busDemo) {
      const contenu = document.createElement('div');
      const titre = document.createElement('strong');
      titre.textContent = bus.nom;

      const description = document.createElement('p');
      description.textContent =
        'Démonstration — position fictive, sans suivi en temps réel.';

      contenu.append(titre, description);

      L.marker(bus.position, {
        icon: iconeBus,
        title: `${bus.nom} — Démonstration`,
        alt: `${bus.nom} — position fictive`,
        keyboard: true,
        riseOnHover: true,
      })
        .addTo(this.map)
        .bindPopup(contenu);
    }
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
    this.map?.remove();
    this.map = undefined;
    this.tiles = undefined;
  }
}