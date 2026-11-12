/**
 * Resumen que se muestra al usuario antes de aplicar una operación de escritura.
 * Es un modelo puro: no conoce cómo se renderiza (Swal, MatDialog, etc.).
 */
export interface ConfirmationRow {
  label: string;
  before: string;
  after: string;
}

export interface ConfirmationSummary {
  title: string;
  /** Párrafos explicativos en texto plano (se renderizan escapados). */
  paragraphs: string[];
  /** Tabla de diferencias «Antes / Después». Vacía si no aplica. */
  rows: ConfirmationRow[];
  /** Encabezados de la tabla; por defecto «Artículo o campo / Antes / Después». */
  rowHeaders?: [string, string, string];
  confirmText: string;
  cancelText: string;
  danger?: boolean;
}

export const EMPTY_VALUE = 'Sin dato';

export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EMPTY_VALUE;
  }
  return value.toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

export function formatText(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : EMPTY_VALUE;
}

/** Normaliza textos opcionales para comparar ('' y null son equivalentes). */
export function normalizeText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}

export function normalizeNumber(value: number | null | undefined): number | null {
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
}
