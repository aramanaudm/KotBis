import { Component, input } from '@angular/core';

export type IconName =
  | 'grid'
  | 'bus'
  | 'pin'
  | 'route'
  | 'zone'
  | 'users'
  | 'flag'
  | 'chat'
  | 'points'
  | 'search'
  | 'plus'
  | 'edit'
  | 'trash'
  | 'arrow'
  | 'back'
  | 'close'
  | 'moon'
  | 'sun'
  | 'menu'
  | 'export'
  | 'check'
  | 'clock';

@Component({
  selector: 'app-icon',
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      @switch (name()) {
        @case ('grid') {
          <rect x="3" y="3" width="7" height="7" rx="1"></rect>
          <rect x="14" y="3" width="7" height="7" rx="1"></rect>
          <rect x="3" y="14" width="7" height="7" rx="1"></rect>
          <rect x="14" y="14" width="7" height="7" rx="1"></rect>
        }
        @case ('bus') {
          <rect x="5" y="3" width="14" height="16" rx="3"></rect>
          <path d="M5 12h14M8 6h8M8 22v-3m8 3v-3M8 16h1m6 0h1"></path>
        }
        @case ('pin') {
          <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"></path>
          <circle cx="12" cy="10" r="2"></circle>
        }
        @case ('route') {
          <circle cx="5" cy="5" r="2"></circle>
          <circle cx="19" cy="19" r="2"></circle>
          <path d="M7 5h9a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h9"></path>
        }
        @case ('zone') {
          <path d="m3 6 7-3 5 4 6-1-2 14-8-2-7 3Z"></path>
        }
        @case ('users') {
          <circle cx="9" cy="7" r="3"></circle>
          <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"></path>
        }
        @case ('flag') {
          <path d="M5 22V3c5-4 9 4 14 0v11c-5 4-9-4-14 0"></path>
        }
        @case ('chat') {
          <path d="M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0Z"></path>
          <path d="M7 9h10M7 13h7"></path>
        }
        @case ('points') {
          <circle cx="12" cy="12" r="9"></circle>
          <path d="m12 6 2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1Z"></path>
        }
        @case ('search') {
          <circle cx="10" cy="10" r="6"></circle>
          <path d="m15 15 6 6"></path>
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14"></path>
        }
        @case ('edit') {
          <path d="m4 15 12-12 5 5L9 20l-6 1Z"></path>
          <path d="m13 6 5 5"></path>
        }
        @case ('trash') {
          <path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"></path>
        }
        @case ('arrow') {
          <path d="m9 5 7 7-7 7"></path>
        }
        @case ('back') {
          <path d="m15 5-7 7 7 7"></path>
        }
        @case ('close') {
          <path d="m6 6 12 12M6 18 18 6"></path>
        }
        @case ('moon') {
          <path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"></path>
        }
        @case ('sun') {
          <circle cx="12" cy="12" r="4"></circle>
          <path
            d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          ></path>
        }
        @case ('menu') {
          <path d="M4 6h16M4 12h16M4 18h16"></path>
        }
        @case ('export') {
          <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"></path>
        }
        @case ('check') {
          <path d="m4 12 5 5L20 6"></path>
        }
        @case ('clock') {
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M12 6v6l4 2"></path>
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.7;
      stroke-linecap: round;
      stroke-linejoin: round;
      flex-shrink: 0;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
}
