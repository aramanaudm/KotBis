import { Component } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-network-map',
  imports: [TranslatePipe],
  template: `
    <div class="map">
      <svg
        viewBox="0 0 600 300"
        preserveAspectRatio="none"
        role="img"
        [attr.aria-label]="'map.networkAria' | t"
      >
        <defs>
          <pattern
            id="streets"
            width="65"
            height="65"
            patternTransform="rotate(26)"
            patternUnits="userSpaceOnUse"
          >
            <path d="M0 0V65M0 0H65" stroke="#dae2dc" stroke-width="3" />
          </pattern>
        </defs>

        <rect width="600" height="300" fill="#e8eeeb" />
        <rect width="600" height="300" fill="url(#streets)" />
        <ellipse cx="40" cy="70" rx="110" ry="90" fill="#cfe2cd" />
        <ellipse cx="550" cy="260" rx="120" ry="70" fill="#cfe2cd" />
        <path d="M-20 260 630 70M240 -20 170 320M0 30 650 200" stroke="white" stroke-width="12" />
      </svg>

      <span class="map-note">{{ 'map.noData' | t }}</span>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .map {
      position: relative;
      height: 280px;
      overflow: hidden;
      background: #e8eeeb;
    }

    svg {
      width: 100%;
      height: 100%;
    }

    .map-note {
      position: absolute;
      bottom: 12px;
      left: 15px;
      padding: 6px 9px;
      color: #6b7f7d;
      font-size: 9px;
      background: #ffffffc9;
      border-radius: 6px;
    }
  `,
})
export class NetworkMap {}
