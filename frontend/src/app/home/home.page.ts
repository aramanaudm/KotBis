import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { NavController } from '@ionic/angular';
import * as L from 'leaflet';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [PartagePositionComponent, RouterLink, RouterOutlet],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  @ViewChild('ficheTitre')
  private ficheTitre?: ElementRef<HTMLHeadingElement>;

  @ViewChild(PartagePositionComponent)
  private partagePosition?: PartagePositionComponent;

  readonly carteIndisponible = signal(false);
  readonly user = inject(AuthService).user;
  private readonly nav = inject(NavController);
  private map?: L.Map;
  private tiles?: L.TileLayer;
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
    if (this.map) { this.map.invalidateSize(); return; }
    this.map = L.map(this.mapContainer.nativeElement, { center: this.centre, zoom: 14, zoomControl: false });
    this.tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    this.tiles.on('tileerror', () => this.carteIndisponible.set(true));
    this.tiles.addTo(this.map);
    this.afficherArrets();
    this.afficherBus();
    this.map.invalidateSize();
  }

  mySpace(): Promise<boolean> { return this.nav.navigateForward('/mon-espace'); }
  zoomer(): void { this.map?.zoomIn(); }
  dezoomer(): void { this.map?.zoomOut(); }
  recentrer(): void { this.map?.setView(this.centre, 14); }
  reessayer(): void { this.carteIndisponible.set(false); this.tiles?.redraw(); }
  ngOnDestroy(): void { this.map?.remove(); this.map = undefined; }
}
