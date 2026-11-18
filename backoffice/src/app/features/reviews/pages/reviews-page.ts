import { Component, computed, inject, signal } from '@angular/core';
import { CsvExportService } from '../../../core/services/csv-export.service';
import { DataTable } from '../../../shared/components/data-table/data-table';
import type { TableColumn, TableRow } from '../../../shared/components/data-table/table.types';
import { FormField } from '../../../shared/components/form-field/form-field';
import { Icon } from '../../../shared/components/icon/icon';
import { Modal } from '../../../shared/components/modal/modal';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Pagination } from '../../../shared/components/pagination/pagination';
import type { Review, ReviewStatus } from '../models/review';
import { REVIEW_STATUS_LABELS, REVIEW_STATUS_TONES } from '../models/review';
import { ReviewsService } from '../services/reviews.service';

@Component({
  selector: 'app-reviews-page',
  imports: [DataTable, FormField, Icon, Modal, PageHeader, Pagination],
  templateUrl: './reviews-page.html',
  styleUrl: './reviews-page.scss',
})
export class ReviewsPage {
  private readonly reviews = inject(ReviewsService);
  private readonly csv = inject(CsvExportService);

  protected readonly pageSize = 6;
  protected readonly statusTones = REVIEW_STATUS_TONES;
  protected readonly columns: readonly TableColumn[] = [
    { key: 'author', label: 'Auteur' },
    { key: 'route', label: 'Trajet' },
    { key: 'comment', label: 'Avis' },
    { key: 'status', label: 'Statut', type: 'status' },
  ];

  protected readonly search = signal('');
  protected readonly statusFilter = signal<ReviewStatus | ''>('');
  protected readonly page = signal(1);

  protected readonly reviewTarget = signal<Review | null>(null);
  protected readonly reviewStatus = signal<ReviewStatus>('pending');
  protected readonly feedback = signal('');

  protected readonly filteredReviews = computed(() => {
    const search = this.search().trim().toLowerCase();
    const filter = this.statusFilter();

    return this.reviews.all().filter((review) => {
      const matchesSearch =
        !search ||
        [review.author, review.route, review.comment].some((value) =>
          value.toLowerCase().includes(search),
        );
      const matchesFilter = !filter || review.status === filter;

      return matchesSearch && matchesFilter;
    });
  });

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredReviews().length / this.pageSize)),
  );

  protected readonly rows = computed<readonly TableRow[]>(() => {
    const page = Math.min(this.page(), this.pageCount());
    const start = (page - 1) * this.pageSize;

    return this.filteredReviews()
      .slice(start, start + this.pageSize)
      .map((review) => ({
        id: review.id,
        values: {
          author: review.author,
          route: review.route,
          comment: review.comment,
          status: REVIEW_STATUS_LABELS[review.status],
        },
      }));
  });

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  protected onFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as ReviewStatus | '');
    this.page.set(1);
  }

  protected changePage(page: number): void {
    this.page.set(page);
  }

  protected openReview(row: TableRow): void {
    const review = this.reviews.all().find((item) => item.id === row.id);

    if (!review) {
      return;
    }

    this.reviewTarget.set(review);
    this.reviewStatus.set(review.status);
  }

  protected closeReview(): void {
    this.reviewTarget.set(null);
  }

  protected onReviewStatus(event: Event): void {
    this.reviewStatus.set((event.target as HTMLSelectElement).value as ReviewStatus);
  }

  protected saveReview(event: Event): void {
    event.preventDefault();

    const review = this.reviewTarget();

    if (!review) {
      return;
    }

    this.closeReview();
    this.showFeedback('Aperçu du template — action à connecter à l’API.');
  }

  protected exportCsv(): void {
    this.csv.export(
      'kotbis-avis.csv',
      ['Auteur', 'Trajet', 'Avis', 'Statut'],
      this.filteredReviews().map((review) => [
        review.author,
        review.route,
        review.comment,
        REVIEW_STATUS_LABELS[review.status],
      ]),
    );
  }

  private showFeedback(message: string): void {
    this.feedback.set(message);
    window.setTimeout(() => this.feedback.set(''), 3000);
  }
}
