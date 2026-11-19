import { Component, inject } from '@angular/core';
import { ZoneMap } from '../../../zones/components/zone-map/zone-map';
import { ZonesService } from '../../../zones/services/zones.service';

@Component({
  selector: 'app-network-map',
  standalone: true,
  imports: [ZoneMap],
  template: `
    <app-zone-map [zones]="zones.active()" />
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      min-width: 0;
      overflow: hidden;
    }
  `,
})
export class NetworkMap {
  protected readonly zones = inject(ZonesService);

  constructor() {
    this.zones.load();
  }
}