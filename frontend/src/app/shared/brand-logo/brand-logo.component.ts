import { Component, input } from '@angular/core';

/** Glyphe d'autobus de face (corps, pare-brise, phares, pieds). Hérite de `currentColor`. */
@Component({
  selector: 'app-bus-icon',
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="3" width="14" height="14" rx="3.2" />
      <path d="M5 9.2h14" />
      <circle cx="9.1" cy="13.2" r="0.6" />
      <circle cx="14.9" cy="13.2" r="0.6" />
      <path d="M8.2 17v3.2M15.8 17v3.2" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 1em;
      height: 1em;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class BusIconComponent {}

/** Logo « Bus Maurice » : pastille verte + glyphe, et le nom (Bus en gras, Maurice en léger). */
@Component({
  selector: 'app-brand-logo',
  imports: [BusIconComponent],
  template: `
    <span class="tile" [style.width.px]="size()" [style.height.px]="size()" [style.fontSize.px]="size() * 0.6">
      <app-bus-icon />
    </span>
    @if (withText()) {
      <span class="name"><b>Bus</b> Maurice</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .tile {
      display: grid;
      place-items: center;
      border-radius: 14px;
      background: var(--bm-green);
      color: var(--bm-navy);
    }
    .name {
      font-size: 20px;
      line-height: 1;
      font-weight: 300;
      letter-spacing: -0.01em;
      color: var(--bm-ink);
    }
    .name b {
      font-weight: 700;
    }
  `,
})
export class BrandLogoComponent {
  readonly size = input(42);
  readonly withText = input(true);
}
