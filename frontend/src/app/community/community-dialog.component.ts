import type { ElementRef } from '@angular/core';
import { afterNextRender, Component, inject, input, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-community-dialog',
  imports: [RouterLink],
  template: `
    <dialog #dialog class="community-dialog" aria-labelledby="community-title" (cancel)="cancel($event)">
      <header class="community-header">
        <a class="community-icon" [routerLink]="backLink()" aria-label="Retour">←</a>
        <h1 id="community-title" tabindex="-1">{{ title() }}</h1>
        <button class="community-icon" type="button" aria-label="Fermer et revenir à la carte" (click)="close()">
          ×
        </button>
      </header>
      <div class="community-body"><ng-content /></div>
    </dialog>
  `,
})
export class CommunityDialogComponent {
  readonly title = input.required<string>();
  readonly backLink = input('/home');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly router = inject(Router);

  constructor() {
    afterNextRender(() => {
      const element = this.dialog().nativeElement;
      if (!element.open) element.showModal();
      element.querySelector<HTMLElement>('h1')?.focus();
    });
  }

  cancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  close(): void {
    void this.router.navigateByUrl('/home');
  }
}
