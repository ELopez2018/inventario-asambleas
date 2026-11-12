import {
  TransportDeliveryReceiptItemResponse,
  TransportDeliveryReceiptResponse,
  UpdateTransportDeliveryReceiptRequest,
} from '../../models/transport-delivery-receipt.model';
import {
  ConfirmationRow,
  ConfirmationSummary,
  formatQuantity,
  formatText,
  normalizeNumber,
  normalizeText,
} from '../confirmation/confirmation-summary';

type HeaderField = Exclude<keyof UpdateTransportDeliveryReceiptRequest, 'items'>;

const HEADER_FIELDS: { key: HeaderField; label: string }[] = [
  { key: 'ownerName', label: 'Propietario' },
  { key: 'ownerPhone', label: 'Teléfono' },
  { key: 'ownerAddress', label: 'Domicilio' },
  { key: 'observations', label: 'Observaciones' },
  { key: 'returnDeliveredTo', label: 'Entréguese a' },
  { key: 'returnDate', label: 'Fecha de devolución' },
  { key: 'returnReceivedBy', label: 'Devolución recibida por' },
];

function receiptItemLabel(item: TransportDeliveryReceiptItemResponse): string {
  return `${item.articleNumber} (ID ${item.id}) · ${formatText(item.description)}`;
}

function allocatedOf(item: TransportDeliveryReceiptItemResponse): number {
  return item.allocatedQuantity ?? item.quantity;
}

/**
 * Construye el modal para guardar el CO-30 (datos propios y devoluciones acumuladas).
 * Devuelve `null` si no hay diferencias.
 */
export function buildCo30SaveSummary(
  receipt: TransportDeliveryReceiptResponse,
  patch: UpdateTransportDeliveryReceiptRequest,
): ConfirmationSummary | null {
  const rows: ConfirmationRow[] = [];
  const returnParagraphs: string[] = [];

  for (const field of HEADER_FIELDS) {
    const before = normalizeText(receipt[field.key]);
    const after = normalizeText(patch[field.key]);
    if (before !== after) rows.push({ label: field.label, before: formatText(before), after: formatText(after) });
  }

  for (const edit of patch.items ?? []) {
    const item = receipt.items.find((current) => current.id === edit.id);
    if (!item) continue;
    const label = receiptItemLabel(item);

    const beforeReturn = normalizeNumber(item.internalReturnQuantity) ?? 0;
    const afterReturn = normalizeNumber(edit.internalReturnQuantity) ?? 0;
    if (beforeReturn !== afterReturn) {
      rows.push({ label: `${label}, acumulado devuelto`, before: formatQuantity(beforeReturn), after: formatQuantity(afterReturn) });
      const delta = afterReturn - beforeReturn;
      if (delta > 0) {
        returnParagraphs.push(`Si aceptas, el acumulado devuelto de ${formatText(item.description)} cambiará de `
          + `${formatQuantity(beforeReturn)} a ${formatQuantity(afterReturn)} unidades. Se registrará el retorno de `
          + `${formatQuantity(delta)} unidades adicionales y aumentará el disponible correspondiente. `
          + 'Se conservará la cantidad solicitada del artículo.');
      } else {
        returnParagraphs.push(`Se corregirá una devolución previa de ${formatText(item.description)}: el acumulado `
          + `pasará de ${formatQuantity(beforeReturn)} a ${formatQuantity(afterReturn)} unidades. No es una nueva `
          + `devolución; ${formatQuantity(-delta)} unidades pueden volver de disponible a en uso, sujeto a la `
          + 'validación del saldo.');
      }
      const pending = allocatedOf(item) - afterReturn;
      if (pending > 0) {
        returnParagraphs.push(`Quedarán ${formatQuantity(pending)} unidades asignadas de ${formatText(item.description)} pendientes de devolver.`);
      }
    }
    if (normalizeText(item.assignedTo) !== normalizeText(edit.assignedTo)) {
      rows.push({ label: `${label}, asignado a`, before: formatText(item.assignedTo), after: formatText(edit.assignedTo) });
    }
    if (normalizeText(item.internalReturnDate) !== normalizeText(edit.internalReturnDate)) {
      rows.push({ label: `${label}, fecha de devolución`, before: formatText(item.internalReturnDate), after: formatText(edit.internalReturnDate) });
    }
    if (normalizeText(item.conditionNotes) !== normalizeText(edit.conditionNotes)) {
      rows.push({ label: `${label}, condición / notas`, before: formatText(item.conditionNotes), after: formatText(edit.conditionNotes) });
    }
  }

  if (!rows.length) return null;

  if (returnParagraphs.length) {
    return {
      title: 'Confirmar devolución registrada',
      paragraphs: returnParagraphs,
      rows,
      confirmText: 'Guardar devolución',
      cancelText: 'Volver a revisar',
    };
  }

  return {
    title: `Confirmar cambios en el CO-30 ${receipt.receiptNumber}`,
    paragraphs: ['Si aceptas, se guardarán los datos del recibo que aparecen en el resumen. '
      + 'No se modifican cantidades solicitadas, asignaciones ni entregas.'],
    rows,
    confirmText: 'Guardar cambios',
    cancelText: 'Volver a revisar',
  };
}

/** Modal para confirmar la entrega física de un renglón del CO-30. */
export function buildDeliveryConfirmationSummary(
  receipt: TransportDeliveryReceiptResponse,
  item: TransportDeliveryReceiptItemResponse,
): ConfirmationSummary {
  const allocated = allocatedOf(item);
  const shortage = item.unavailableQuantity ?? Math.max(0, item.quantity - allocated);
  const description = formatText(item.description);

  const rows: ConfirmationRow[] = [
    { label: 'CO-30', before: receipt.receiptNumber, after: '' },
    { label: 'Cantidad solicitada', before: formatQuantity(item.quantity), after: '' },
    { label: 'Cantidad asignada', before: formatQuantity(allocated), after: '' },
  ];
  if (shortage > 0) rows.push({ label: 'Faltante', before: formatQuantity(shortage), after: item.inventoryAdjustmentNote ?? '' });

  const paragraphs = [
    `Si aceptas, confirmarás la entrega física de ${formatQuantity(allocated)} unidades de ${description} `
      + `del CO-30 ${receipt.receiptNumber}. Este artículo quedará protegido: no podrás cambiar su cantidad, `
      + 'descripción ni eliminarlo desde el CO-31. Los demás artículos pendientes seguirán editables. '
      + 'Esta confirmación no tiene una opción para deshacerla; el retorno del material se registra mediante una devolución.',
  ];
  if (shortage > 0) {
    paragraphs.push(`Se solicitaron ${formatQuantity(item.quantity)} y se confirmarán las ${formatQuantity(allocated)} asignadas.`
      + (item.inventoryAdjustmentNote ? ` Se conservará la nota «${item.inventoryAdjustmentNote}»;` : '')
      + ' esta acción no confirma la entrega de las unidades faltantes.');
  }
  if (isLastPendingItem(receipt, item)) {
    paragraphs.push('Al confirmar este artículo, la solicitud completa pasará a ENTREGADA.');
  }

  return {
    title: `Confirmar entrega de ${description}`,
    paragraphs,
    rows,
    rowHeaders: ['Dato', 'Valor', 'Nota'],
    confirmText: 'Sí, confirmar entrega',
    cancelText: 'Cancelar',
  };
}

export function isLastPendingItem(
  receipt: TransportDeliveryReceiptResponse,
  item: TransportDeliveryReceiptItemResponse,
): boolean {
  return receipt.items.every((current) => current.id === item.id || current.deliveryConfirmed);
}
