import { Component, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import type { ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';

import { COMMUNITY_SESSION } from './community-session';
import type { Review } from './review.model';
import { ReviewService } from './review.service';

@Component({
  selector: 'app-review-actions',
  imports: [RouterLink],
  template: `
    @if (isOwner()) {
      <div class="community-actions">
        <a class="community-button community-button-outline" [routerLink]="['/home/avis/modifier', review().id]"
          >Modifier</a
        >
        <button
          #deleteButton
          class="community-button community-button-outline community-danger"
          type="button"
          [disabled]="busy()"
          (click)="confirming.set(true)"
        >
          Supprimer
        </button>
      </div>
      @if (confirming()) {
        <div class="community-confirmation" role="group" [attr.aria-labelledby]="'delete-question-' + review().id">
          <p [id]="'delete-question-' + review().id">
            Supprimer votre avis sur le bus {{ review().busLine }} ? Cette action est définitive.
          </p>
          <div class="community-actions">
            <button
              #cancelButton
              class="community-button community-button-outline"
              type="button"
              [disabled]="busy()"
              (click)="cancel()"
            >
              Annuler
            </button>
            <button
              class="community-button community-button-danger"
              type="button"
              [disabled]="busy()"
              (click)="remove()"
            >
              {{ busy() ? 'Suppression…' : 'Confirmer la suppression' }}
            </button>
          </div>
        </div>
      }
    }
    @if (error()) {
      <p class="community-error" role="alert">{{ error() }}</p>
    }
  `,
})
export class ReviewActionsComponent {
  readonly review = input.required<Review>();
  private readonly user = inject(COMMUNITY_SESSION);
  private readonly service = inject(ReviewService);
  readonly isOwner = computed(() => this.user()?.id === this.review().userId);
  readonly confirming = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');
  private readonly deleteButton = viewChild<ElementRef<HTMLButtonElement>>('deleteButton');

  constructor() {
    effect(() => this.cancelButton()?.nativeElement.focus());
  }

  cancel(): void {
    this.confirming.set(false);
    this.error.set('');
    this.deleteButton()?.nativeElement.focus();
  }

  async remove(): Promise<void> {
    if (this.busy() || !this.confirming()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.service.deleteReview(this.review().id);
      this.confirming.set(false);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Suppression impossible. Réessayez.');
    } finally {
      this.busy.set(false);
    }
  }
}
