import { ConfirmationSummary, formatQuantity, formatText } from '../confirmation/confirmation-summary';

export interface InventoryAdjustmentDraft {
  itemDescription: string;
  storeName: string;
  quantityDelta: number;
  reason: string;
}

export const ADJUSTMENT_REASON_MAX_LENGTH = 1000;

/** Valida el borrador del ajuste. Devuelve el mensaje de error o `null` si es válido. */
export function validateAdjustmentDraft(draft: { storeId: number; quantityDelta: number; reason: string }): string | null {
  if (!draft.storeId || draft.storeId < 1) return 'Selecciona la bodega.';
  if (!Number.isFinite(draft.quantityDelta) || draft.quantityDelta === 0) return 'Indica una cantidad distinta de cero.';
  if (Math.round(Math.abs(draft.quantityDelta) * 100) !== Math.abs(draft.quantityDelta) * 100) {
    return 'La cantidad admite hasta dos decimales.';
  }
  const reason = draft.reason.trim();
  if (!reason) return 'La razón del ajuste es obligatoria.';
  if (reason.length > ADJUSTMENT_REASON_MAX_LENGTH) return 'La razón admite hasta 1000 caracteres.';
  return null;
}

export function buildAdjustmentConfirmationSummary(draft: InventoryAdjustmentDraft): ConfirmationSummary {
  const removing = draft.quantityDelta < 0;
  const quantity = formatQuantity(Math.abs(draft.quantityDelta));
  const item = formatText(draft.itemDescription);
  const store = formatText(draft.storeName);

  const main = removing
    ? `Si aceptas, se retirarán ${quantity} unidades de ${item} de la existencia de ${store} por la razón indicada. `
      + 'Se reducirán primero las asignaciones pendientes del pedido más reciente y se continuará con los anteriores '
      + 'del mismo artículo y bodega. Si aún hace falta retirar unidades, se reducirá el disponible. Los CO-30 afectados '
      + `mostrarán el faltante, por ejemplo «(-${quantity} Falta inventario)», conservando lo solicitado.`
    : `Si aceptas, se agregarán ${quantity} unidades de ${item} a la existencia de ${store}. Se completarán primero `
      + 'los faltantes del pedido más reciente y después los anteriores que sean elegibles. El sobrante quedará '
      + 'disponible. Las notas de faltante se reducirán o desaparecerán según las unidades repuestas.';

  return {
    title: 'Confirmar ajuste de inventario',
    paragraphs: [
      main,
      'Se conservarán los artículos entregados y las solicitudes finalizadas. El ajuste quedará registrado con su '
        + 'razón, responsable y documentos afectados. Si no puede completarse, no se aplicará parcialmente.',
    ],
    rows: [
      { label: 'Artículo', before: item, after: '' },
      { label: 'Bodega', before: store, after: '' },
      { label: 'Tipo de ajuste', before: removing ? 'Retirar unidades' : 'Agregar unidades', after: '' },
      { label: 'Cantidad', before: `${removing ? '-' : '+'}${quantity}`, after: '' },
      { label: 'Razón', before: draft.reason.trim(), after: '' },
    ],
    rowHeaders: ['Dato', 'Valor', ''],
    confirmText: 'Aplicar ajuste',
    cancelText: 'Volver a revisar',
    danger: removing,
  };
}
