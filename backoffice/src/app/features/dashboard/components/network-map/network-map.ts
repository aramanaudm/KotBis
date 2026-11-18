import { Component, computed, inject, signal } from '@angular/core';
import { apiError } from '../../../../core/services/api';
import type { Stop } from '../../../stops/models/stop';
import { StopsService } from '../../../stops/services/stops.service';
import { ZoneMap } from '../../../zones/components/zone-map/zone-map';
import { ZonesService } from '../../../zones/services/zones.service';

@Component({
  selector: 'app-network-map',
  standalone: true,
  imports: [ZoneMap],
  template: `
    <div class="map-toolbar">
      <label for="zone-select">Zone</label>
      <select id="zone-select" (change)="choisirZone($event)">
        <option value="">Toutes les zones</option>
        @for (zone of zones.active(); track zone.id) {
          <option [value]="zone.id">{{ zone.name }}</option>
        }
      </select>

      @if (zoneSelectionnee()) {
        <span class="stop-count">{{ arrets().length }} arrêt(s)</span>
      } @else {
        <span class="map-note">{{ zones.active().length }} zone(s) active(s)</span>
      }

      @if (erreur()) {
        <span class="map-error">{{ erreur() }}</span>
      }
    </div>

    <app-zone-map [zones]="zonesAffichees()" [stops]="arrets()" />
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      min-width: 0;
      overflow: hidden;
    }

    .map-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 9px;
      padding: 12px 22px;
      color: var(--muted);
      font-size: 10px;
      border-bottom: 1px solid var(--line);
    }

    .map-toolbar label {
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .map-toolbar select {
      min-width: 180px;
      padding: 7px 9px;
      color: var(--ink);
      font-size: 11px;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 7px;
    }

    .stop-count {
      margin-left: auto;
      color: var(--green);
      font-weight: 600;
    }

    .map-note {
      margin-left: auto;
    }

    .map-error {
      color: var(--red);
    }
  `,
})
export class NetworkMap {
  protected readonly zones = inject(ZonesService);
  private readonly stops = inject(StopsService);

  protected readonly zoneSelectionnee = signal('');
  protected readonly arrets = signal<readonly Stop[]>([]);
  protected readonly erreur = signal('');

  protected readonly zonesAffichees = computed(() => {
    const id = this.zoneSelectionnee();

    return id ? this.zones.active().filter((zone) => zone.id === id) : this.zones.active();
  });

  constructor() {
    this.zones.load();
  }

  protected choisirZone(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.zoneSelectionnee.set(id);
    this.erreur.set('');

    if (!id) {
      this.arrets.set([]);
      return;
    }

    this.stops.stopsForZone(id).subscribe({
      next: (stops) => {
        if (this.zoneSelectionnee() === id) {
          this.arrets.set(stops);
        }
      },
      error: (err) => {
        this.arrets.set([]);
        this.erreur.set(apiError(err));
      },
    });
  }
}
