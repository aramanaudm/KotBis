import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';

import { CommunityDialogComponent } from './community-dialog.component';
import { ReviewService } from './review.service';

@Component({
  selector: 'app-review-list',
  imports: [CommunityDialogComponent, DatePipe],
  templateUrl: './review-list.page.html',
})
export class ReviewListPage {
  readonly reviews = inject(ReviewService).reviews;
}
