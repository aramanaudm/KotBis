import type { StatusTone } from '../../../shared/models/status';

export type ReviewStatus = 'pending' | 'published' | 'hidden';

export interface Review {
  readonly id: string;
  readonly author: string;
  readonly route: string;
  readonly comment: string;
  readonly status: ReviewStatus;
}

export const REVIEW_STATUS_LABELS: Readonly<Record<ReviewStatus, string>> = {
  pending: 'À vérifier',
  published: 'Publié',
  hidden: 'Masqué',
};

export const REVIEW_STATUS_TONES: Readonly<Record<string, StatusTone>> = {
  'status.review.pending': 'orange',
  'status.review.published': 'green',
  'status.review.hidden': 'neutral',
};
