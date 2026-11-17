import { computed, Injectable, signal } from '@angular/core';
import type { Review } from '../models/review';

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly reviews = signal<Review[]>([]);

  readonly all = this.reviews.asReadonly();
  readonly pending = computed(() => this.reviews().filter((review) => review.status === 'pending'));
  readonly total = computed(() => this.reviews().length);
}
