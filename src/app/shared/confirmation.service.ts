import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';
import { ConfirmationSummary } from '../domain/confirmation/confirmation-summary';

interface ConfirmationOptions {
  title: string;
  text: string;
  confirmButtonText?: string;
  confirmButtonColor?: string;
}

const PRIMARY_COLOR = '#3f51b5';
const DANGER_COLOR = '#b91c1c';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Renderiza el resumen como HTML; todo el texto se escapa (incluye datos escritos por el usuario). */
export function renderSummaryHtml(summary: ConfirmationSummary): string {
  const paragraphs = summary.paragraphs
    .map((text) => `<p style="margin:0 0 .75rem;text-align:left">${escapeHtml(text)}</p>`)
    .join('');

  if (!summary.rows.length) return paragraphs;

  const threeColumns = summary.rows.some((row) => row.after !== '');
  const [h1, h2, h3] = summary.rowHeaders ?? ['Artículo o campo', 'Antes', 'Después'];
  const cell = 'style="border:1px solid #e2e8f0;padding:.35rem .5rem;text-align:left;vertical-align:top;word-break:break-word"';
  const header = `<tr><th ${cell}>${escapeHtml(h1)}</th><th ${cell}>${escapeHtml(h2)}</th>`
    + (threeColumns ? `<th ${cell}>${escapeHtml(h3)}</th>` : '') + '</tr>';
  const body = summary.rows
    .map((row) => `<tr><td ${cell}>${escapeHtml(row.label)}</td><td ${cell}>${escapeHtml(row.before)}</td>`
      + (threeColumns ? `<td ${cell}>${escapeHtml(row.after)}</td>` : '') + '</tr>')
    .join('');

  return `<div style="max-height:40vh;overflow:auto;margin-bottom:1rem">`
    + `<table style="width:100%;border-collapse:collapse;font-size:.85rem">${header}${body}</table></div>`
    + paragraphs;
}

@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  private dialogOpen = false;

  async confirm(options: ConfirmationOptions): Promise<boolean> {
    if (this.dialogOpen) {
      return false;
    }

    this.dialogOpen = true;

    try {
      const result = await Swal.fire({
        icon: 'warning',
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        confirmButtonText: 'Sí, continuar',
        confirmButtonColor: PRIMARY_COLOR,
        focusCancel: true,
        ...options,
      });

      return result.isConfirmed;
    } finally {
      this.dialogOpen = false;
    }
  }

  /**
   * Muestra el resumen de una operación. Cancelar, cerrar o presionar Escape devuelve `false`
   * y no aplica nada.
   */
  async confirmSummary(summary: ConfirmationSummary): Promise<boolean> {
    if (this.dialogOpen) {
      return false;
    }

    this.dialogOpen = true;

    try {
      const result = await Swal.fire({
        icon: 'warning',
        title: summary.title,
        html: renderSummaryHtml(summary),
        width: 'min(96vw, 46rem)',
        showCancelButton: true,
        cancelButtonText: summary.cancelText,
        confirmButtonText: summary.confirmText,
        confirmButtonColor: summary.danger ? DANGER_COLOR : PRIMARY_COLOR,
        focusCancel: true,
      });

      return result.isConfirmed;
    } finally {
      this.dialogOpen = false;
    }
  }

  confirmDelete(text: string): Promise<boolean> {
    return this.confirm({
      title: 'Confirmar eliminación',
      text,
      confirmButtonText: 'Sí, eliminar',
      confirmButtonColor: DANGER_COLOR,
    });
  }
}
