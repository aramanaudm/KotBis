import { Component, input, output } from '@angular/core';
import { StatusBadge } from '../status-badge/status-badge';
import { Icon } from '../icon/icon';
import type { IconName } from '../icon/icon';
import type { StatusTone } from '../../models/status';
import type { TableColumn, TableRow } from './table.types';

@Component({
  selector: 'app-data-table',
  imports: [Icon, StatusBadge],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
})
export class DataTable {
  readonly columns = input.required<readonly TableColumn[]>();
  readonly rows = input.required<readonly TableRow[]>();
  readonly statusTones = input<Readonly<Record<string, StatusTone>>>({});
  readonly showActions = input(true);
  readonly showEdit = input(true);
  readonly showRemove = input(true);
  readonly editLabel = input('Modifier');
  readonly removeLabel = input('Supprimer');
  readonly editIcon = input<IconName>('edit');
  readonly removeIcon = input<IconName>('trash');
  readonly emptyMessage = input('Aucun résultat.');

  readonly edit = output<TableRow>();
  readonly remove = output<TableRow>();

  protected statusTone(value: string): StatusTone {
    return this.statusTones()[value] ?? 'neutral';
  }
}
