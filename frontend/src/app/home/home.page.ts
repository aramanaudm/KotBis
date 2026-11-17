import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { NavController } from '@ionic/angular';
import * as L from 'leaflet';
import { AuthService } from '../core/auth/auth.service';

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
  readonly user = inject(AuthService).user;
  private readonly nav = inject(NavController);
  private map?: L.Map;
  private tiles?: L.TileLayer;
  private readonly centre: L.LatLngTuple = [-20.233, 57.467];

  ionViewDidEnter(): void {
    if (this.map) { this.map.invalidateSize(); return; }
    this.map = L.map(this.mapContainer.nativeElement, { center: this.centre, zoom: 14, zoomControl: false });
    this.tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    this.tiles.on('tileerror', () => this.carteIndisponible.set(true));
    this.tiles.addTo(this.map);
    this.map.invalidateSize();
  }

  mySpace(): Promise<boolean> { return this.nav.navigateForward('/mon-espace'); }
  zoomer(): void { this.map?.zoomIn(); }
  dezoomer(): void { this.map?.zoomOut(); }
  recentrer(): void { this.map?.setView(this.centre, 14); }
  reessayer(): void { this.carteIndisponible.set(false); this.tiles?.redraw(); }
  ngOnDestroy(): void { this.map?.remove(); this.map = undefined; }
}
