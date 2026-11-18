import { Component, input } from '@angular/core';
import type { StatusTone } from '../../models/status';

@Component({
  selector: 'app-status-badge',
  template: `
    <span
      class="badge"
      [class.green]="tone() === 'green'"
      [class.orange]="tone() === 'orange'"
      [class.red]="tone() === 'red'"
    >
      {{ label() }}
    </span>
  `,
  styles: `
    .badge {
      display: inline-block;
      padding: 5px 9px;
      color: #56708c;
      font-size: 10px;
      background: #e4ecf5;
      border-radius: 5px;
    }

    .badge.green {
      color: var(--green);
      background: #22aa7b12;
    }

    .badge.orange {
      color: var(--orange);
      background: #ed9c1515;
    }

    .badge.red {
      color: var(--red);
      background: #e35d6412;
    }
  `,
})
export class StatusBadge {
  readonly label = input.required<string>();
  readonly tone = input<StatusTone>('neutral');
}
