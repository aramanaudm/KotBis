import { Component, input } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-page-header',
  imports: [TranslatePipe],
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss',
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly eyebrow = input('layout.eyebrow');
}
