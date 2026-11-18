import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CsvExportService {
  export(filename: string, headers: readonly string[], rows: readonly (readonly string[])[]): void {
    const lines = [headers, ...rows].map((row) => row.map((cell) => this.escape(cell)).join(';'));
    const content = `\uFEFF${lines.join('\r\n')}`;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private escape(value: string): string {
    const safe = value.replace(/"/g, '""').replace(/^[=+@-]/, "'$&");

    return `"${safe}"`;
  }
}
