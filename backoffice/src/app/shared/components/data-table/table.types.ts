export interface TableColumn {
  readonly key: string;
  readonly label: string;
  readonly type?: 'text' | 'status' | 'avatar';
}

export interface TableRow {
  readonly id: string;
  readonly values: Readonly<Record<string, string>>;
}
