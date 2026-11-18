import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap, type Observable } from 'rxjs';
import { apiError, apiUrl } from '../../../core/services/api';
import type { Review, ReviewStatus } from '../models/review';

interface ApiReview {
  id: string;
  reference: string;
  auteur: string;
  trajet: string;
  texte: string;
  statut: 'a_verifier' | 'publie' | 'masque';
}

const STATUT_TO_API: Record<ReviewStatus, string> = {
  pending: 'a_verifier',
  published: 'publie',
  hidden: 'masque',
};

const API_TO_STATUT: Record<string, ReviewStatus> = {
  a_verifier: 'pending',
  publie: 'published',
  masque: 'hidden',
};

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly http = inject(HttpClient);
  private readonly reviews = signal<Review[]>([]);
  private readonly erreur = signal('');

  readonly all = this.reviews.asReadonly();
  readonly pending = computed(() => this.reviews().filter((review) => review.status === 'pending'));
  readonly total = computed(() => this.reviews().length);
  readonly error = this.erreur.asReadonly();

  load(): void {
    this.http.get<{ success: boolean; data: ApiReview[] }>(`${apiUrl}/api/admin/reviews`).subscribe({
      next: (res) => {
        this.erreur.set('');
        this.reviews.set(
          res.data.map((review) => ({
            id: review.reference,
            author: review.auteur,
            route: review.trajet,
            comment: review.texte,
            status: API_TO_STATUT[review.statut] ?? 'pending',
          })),
        );
      },
      error: (err) => this.erreur.set(apiError(err)),
    });
  }

  update(id: string, statut: ReviewStatus): Observable<void> {
    return this.http
      .put<{ success: boolean }>(`${apiUrl}/api/admin/reviews/${id}`, {
        statut: STATUT_TO_API[statut],
      })
      .pipe(tap(() => this.load()), map(() => undefined));
  }

  hide(id: string): Observable<void> {
    return this.http
      .delete<{ success: boolean }>(`${apiUrl}/api/admin/reviews/${id}`)
      .pipe(tap(() => this.load()), map(() => undefined));
  }
}
