import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { COMMUNITY_BUSES } from './community-buses';
import { CommunityDialogComponent } from './community-dialog.component';
import { COMMUNITY_SESSION } from './community-session';
import { REVIEW_MAX_LENGTH } from './review.constants';
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
  readonly maxLength = REVIEW_MAX_LENGTH;
  private readonly reviews = inject(ReviewService);
  private readonly router = inject(Router);
  readonly editId = inject(ActivatedRoute).snapshot.paramMap.get('id');
  readonly canEdit = computed(
    () =>
      !this.editId ||
      this.reviews.reviews().some((review) => review.id === this.editId && review.userId === this.user()?.id),
  );
  readonly form = inject(FormBuilder).nonNullable.group({
    busId: ['', Validators.required],
    text: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(REVIEW_MAX_LENGTH)]],
  });
  private readonly textValue = toSignal(this.form.controls.text.valueChanges, { initialValue: '' });
  readonly characterCount = computed(() => this.textValue().length);

  constructor() {
    effect(() => {
      const user = this.user();
      if (!this.editId) return;
      untracked(() => {
        const review = this.reviews.reviews().find((item) => item.id === this.editId && item.userId === user?.id);
        this.form.patchValue({ busId: review?.busId ?? '', text: review?.text ?? '' });
        this.form.controls.busId.disable();
      });
    });
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.editId) {
        await this.reviews.updateReview(this.editId, this.form.controls.text.value);
      } else {
        await this.reviews.createReview(this.form.getRawValue());
      }
      await this.router.navigateByUrl('/home/avis');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "La publication n'a pas abouti. Réessayez.");
    } finally {
      this.busy.set(false);
    }
  }
}
