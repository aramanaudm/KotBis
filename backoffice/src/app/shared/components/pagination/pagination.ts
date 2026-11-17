import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  template: `
    <div class="pagination">
      <span>{{ total() }} élément(s)</span>
      <div class="controls">
        <button type="button" [disabled]="page() === 1" (click)="previous()">←</button>
        <span>{{ page() }} / {{ pageCount() }}</span>
        <button type="button" [disabled]="page() >= pageCount()" (click)="next()">→</button>
      </div>
    </div>
  `,
  styles: `
    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 22px;
      color: var(--muted);
      font-size: 10px;
      border-top: 1px solid var(--line);
    }

    .controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    button {
      padding: 7px 10px;
      color: var(--ink);
      background: transparent;
      border: 0;
    }

    button:disabled {
      opacity: 0.35;
      cursor: default;
    }
  `,
})
export class Pagination {
  readonly page = input.required<number>();
  readonly total = input.required<number>();
  readonly pageSize = input(6);

  readonly pageChange = output<number>();

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize())),
  );

  protected previous(): void {
    if (this.page() > 1) {
      this.pageChange.emit(this.page() - 1);
    }
  }

  protected next(): void {
    if (this.page() < this.pageCount()) {
      this.pageChange.emit(this.page() + 1);
    }
  }
}
