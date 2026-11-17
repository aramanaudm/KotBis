import { computed, Injectable, signal } from '@angular/core';
import type { Report } from '../models/report';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly reports = signal<Report[]>([]);

  readonly all = this.reports.asReadonly();
  readonly pending = computed(() => this.reports().filter((report) => report.status === 'pending'));
  readonly total = computed(() => this.reports().length);
}
