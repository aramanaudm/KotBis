import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { COMMUNITY_BUSES } from './community-buses';
import { CommunityDialogComponent } from './community-dialog.component';
import { COMMUNITY_SESSION } from './community-session';
import { ReviewService } from './review.service';

@Component({
  selector: 'app-review-form',
  imports: [CommunityDialogComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './review-form.page.html',
})
export class ReviewFormPage {
  readonly user = inject(COMMUNITY_SESSION);
  readonly buses = COMMUNITY_BUSES;
  readonly busy = signal(false);
  readonly error = signal('');
  private readonly reviews = inject(ReviewService);
  private readonly router = inject(Router);
  readonly form = inject(FormBuilder).nonNullable.group({
    busId: ['', Validators.required],
    text: ['', [Validators.required, Validators.pattern(/\S/)]],
  });

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.reviews.createReview(this.form.getRawValue());
      await this.router.navigateByUrl('/home/avis');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "La publication n'a pas abouti. Réessayez.");
    } finally {
      this.busy.set(false);
    }
  }
}
