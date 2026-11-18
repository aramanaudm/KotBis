import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CommunityDialogComponent } from './community-dialog.component';
import { ReviewActionsComponent } from './review-actions.component';
import { ReviewService } from './review.service';

@Component({
  selector: 'app-review-list',
  imports: [CommunityDialogComponent, DatePipe, RouterLink, ReviewActionsComponent],
  templateUrl: './review-list.page.html',
})
export class ReviewListPage {
  readonly reviews = inject(ReviewService).reviews;
  readonly notice = inject(ReviewService).notice;
}
