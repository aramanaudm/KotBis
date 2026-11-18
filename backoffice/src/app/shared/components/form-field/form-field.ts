import { Component, input } from '@angular/core';

@Component({
  selector: 'app-form-field',
  template: `
    <div class="field">
      <label [for]="forId()">{{ label() }}</label>
      <ng-content />
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
    </div>
  `,
  styles: `
    .field {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    label {
      color: var(--muted);
      font-size: 11px;
    }

    .error {
      color: var(--red);
      font-size: 10px;
    }
  `,
})
export class FormField {
  readonly label = input.required<string>();
  readonly forId = input.required<string>();
  readonly error = input('');
}
