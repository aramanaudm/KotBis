import { Component, computed, inject, signal } from '@angular/core';
import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LanguageService } from '../../../core/i18n/language.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { apiError } from '../../../core/services/api';
import { CsvExportService } from '../../../core/services/csv-export.service';
import { DataTable } from '../../../shared/components/data-table/data-table';
import type { TableColumn, TableRow } from '../../../shared/components/data-table/table.types';
import { FormField } from '../../../shared/components/form-field/form-field';
import { Icon } from '../../../shared/components/icon/icon';
import { Modal } from '../../../shared/components/modal/modal';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import type { UserBalance } from '../models/point';
import { PointsService } from '../services/points.service';

const INTEGER_AMOUNT: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = Number(control.value);

  return control.value !== null && control.value !== '' && Number.isInteger(value) && value !== 0
    ? null
    : { amount: true };
};

@Component({
  selector: 'app-points-page',
  imports: [DataTable, FormField, Icon, Modal, PageHeader, ReactiveFormsModule, TranslatePipe],
  templateUrl: './points-page.html',
  styleUrl: './points-page.scss',
})
export class PointsPage {
  private readonly points = inject(PointsService);
  private readonly csv = inject(CsvExportService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18n = inject(LanguageService);

  constructor() {
    this.points.load();
  }

  protected readonly balances = this.points.balances;
  protected readonly history = this.points.history;

  protected readonly balanceColumns: readonly TableColumn[] = [
    { key: 'pseudo', label: 'points.column.user' },
    { key: 'email', label: 'points.column.email' },
    { key: 'points', label: 'points.column.points' },
  ];

  protected readonly historyColumns: readonly TableColumn[] = [
    { key: 'user', label: 'points.column.user' },
    { key: 'variation', label: 'points.column.variation' },
    { key: 'reason', label: 'points.column.reason' },
    { key: 'date', label: 'points.column.date' },
  ];

  protected readonly adjustTarget = signal<UserBalance | null>(null);
  protected readonly formError = signal('');
  protected readonly feedback = signal('');

  protected readonly form = this.formBuilder.nonNullable.group({
    variation: [
      1,
      [Validators.required, Validators.min(-10000), Validators.max(10000), INTEGER_AMOUNT],
    ],
    reason: ['', [Validators.required, Validators.maxLength(250)]],
  });

  protected readonly balanceRows = computed<readonly TableRow[]>(() =>
    this.balances().map((balance) => ({
      id: balance.id,
      values: {
        pseudo: balance.pseudo,
        email: balance.email,
        points: String(balance.points),
      },
    })),
  );

  protected readonly historyRows = computed<readonly TableRow[]>(() =>
    this.history().map((movement) => ({
      id: movement.id,
      values: {
        user: movement.userName,
        variation: this.formatVariation(movement.variation),
        reason: movement.reason,
        date: this.formatDate(movement.date),
      },
    })),
  );

  protected openAdjust(row: TableRow): void {
    const balance = this.balances().find((item) => item.id === row.id);

    if (!balance) {
      return;
    }

    this.adjustTarget.set(balance);
    this.formError.set('');
    this.form.reset({ variation: 1, reason: '' });
  }

  protected closeAdjust(): void {
    this.adjustTarget.set(null);
    this.formError.set('');
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const balance = this.adjustTarget();

    if (!balance) {
      return;
    }

    const reason = this.form.controls.reason.value.trim();

    if (!reason) {
      this.formError.set('points.error.reason');
      return;
    }

    this.points
      .adjust(balance.id, this.form.controls.variation.value, reason)
      .subscribe({
        next: () => {
          this.closeAdjust();
          this.showFeedback('points.feedback.updated');
        },
        error: (err) => this.formError.set(apiError(err)),
      });
  }

  protected amountError(): string {
    const control = this.form.controls.variation;

    return control.touched && control.invalid ? 'points.error.amount' : '';
  }

  protected reasonError(): string {
    const control = this.form.controls.reason;

    return control.touched && control.invalid ? 'points.error.reason' : '';
  }

  protected exportCsv(): void {
    this.csv.export(
      'kotbis-points.csv',
      [
        this.i18n.t('points.column.user'),
        this.i18n.t('points.column.variation'),
        this.i18n.t('points.column.reason'),
        this.i18n.t('points.column.date'),
      ],
      this.history().map((movement) => [
        movement.userName,
        this.formatVariation(movement.variation),
        movement.reason,
        this.formatDate(movement.date),
      ]),
    );
  }

  private formatVariation(variation: number): string {
    return variation > 0 ? `+${variation}` : String(variation);
  }

  private formatDate(date: string): string {
    const locale = this.i18n.lang() === 'en' ? 'en-GB' : 'fr-FR';

    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(date));
  }

  private showFeedback(key: string): void {
    this.feedback.set(this.i18n.t(key));
    window.setTimeout(() => this.feedback.set(''), 3000);
  }
}
