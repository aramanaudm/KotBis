import { Component, HostListener, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-modal',
  imports: [Icon],
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
})
export class Modal {
  readonly title = input.required<string>();
  readonly close = output<void>();

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close.emit();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }
}
