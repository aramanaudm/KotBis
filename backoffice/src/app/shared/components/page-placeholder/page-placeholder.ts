import { Component, input } from '@angular/core';
import { Icon } from '../icon/icon';
import { PageHeader } from '../page-header/page-header';

@Component({
  selector: 'app-page-placeholder',
  imports: [Icon, PageHeader],
  templateUrl: './page-placeholder.html',
  styleUrl: './page-placeholder.scss',
})
export class PagePlaceholder {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
