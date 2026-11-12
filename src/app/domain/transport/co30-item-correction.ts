import {
  ReceiptItemCorrectionResponse,
  ReceiptItemCorrectionStockMode,
  ReceiptItemCorrectionType,
  TransportDeliveryReceiptItemResponse,
  TransportDeliveryReceiptResponse,
} from '../../models/transport-delivery-receipt.model';
import {
  TRANSPORT_REQUEST_RELEASE_STOCK_STATUSES,
  TransportRequestStatus,
} from '../../models/transport-request.model';
import { formatQuantity } from '../confirmation/confirmation-summary';

/**
 * Reglas puras para corregir la cantidad, eliminar renglones o marcar unidades no encontradas del CO-30
 * (el backend vuelve a validarlas; aquí solo se usan para ocultar/deshabilitar acciones y guiar al usuario).
 */

export const CORRECTION_REASON_MAX_LENGTH = 1000;

/** Máximo de dígitos enteros que acepta el backend en las cantidades. */
export const CORRECTION_QUANTITY_MAX_INTEGER_DIGITS = 16;

export const RECEIPT_CORRECTION_ERROR = {
  itemNotFound: 'INV-RECEIPT-CORRECTION-ITEM-001',
  /** Aumento manual en un renglón sin artículo de inventario identificable: usar AUTOMATIC. */
  manualIncrease: 'INV-RECEIPT-CORRECTION-ITEM-002',
  manualRemoval: 'INV-RECEIPT-CORRECTION-MANUAL-REMOVAL-001',
  /** No se ubicaron en bodega las unidades a dar de baja: recargar el CO-30 o usar MANUAL. */
  notFoundUnlocated: 'INV-RECEIPT-CORRECTION-NOT-FOUND-003',
} as const;

/** Errores que se resuelven reintentando en modo automático. */
export const RETRY_AUTOMATIC_ERRORS: readonly string[] = [
  RECEIPT_CORRECTION_ERROR.manualRemoval,
  RECEIPT_CORRECTION_ERROR.manualIncrease,
];

export const STOCK_MODE_LABELS: Record<ReceiptItemCorrectionStockMode, string> = {
  AUTOMATIC: 'Ajustar inventario automáticamente',
  MANUAL: 'Lo ajustaré manualmente',
};

export const CORRECTION_TYPE_LABELS: Record<ReceiptItemCorrectionType, string> = {
  QUANTITY_CHANGE: 'Cambio de cantidad',
  LINE_REMOVAL: 'Renglón eliminado',
  NOT_FOUND: 'No se encontraron',
};

export const STOCK_MODE_REQUIRED_MESSAGE = 'Elige cómo se ajusta el inventario.';

function allocatedOf(item: TransportDeliveryReceiptItemResponse): number {
  return item.allocatedQuantity ?? item.quantity;
}

export function notFoundOf(item: TransportDeliveryReceiptItemResponse): number {
  return item.notFoundQuantity ?? 0;
}

/** Unidades que todavía se pueden marcar como no encontradas (`quantity - notFoundQuantity`). */
export function notFoundRemaining(item: TransportDeliveryReceiptItemResponse): number {
  return Math.max(0, item.quantity - notFoundOf(item));
}

/** Faltante por inventario: unidades sin existencia asignada (excluye las no encontradas). */
function unavailableOf(item: TransportDeliveryReceiptItemResponse): number {
  return item.unavailableQuantity ?? Math.max(0, item.quantity - notFoundOf(item) - allocatedOf(item));
}

/**
 * Unidades asignadas en bodega afectadas al marcar `quantity` como no encontradas:
 * primero se descuentan las que no estaban asignadas (sin existencia).
 */
export function notFoundAllocatedImpact(item: TransportDeliveryReceiptItemResponse, quantity: number): number {
  return Math.min(allocatedOf(item), Math.max(0, quantity - unavailableOf(item)));
}

/** El CO-31 sigue en curso: no está ENTREGADA ni en un estado que libera existencia. */
export function isRequestOpenForCorrections(status: TransportRequestStatus | null | undefined): boolean {
  if (!status) return true; // Estado desconocido: decide el backend.
  return status !== 'ENTREGADA' && !TRANSPORT_REQUEST_RELEASE_STOCK_STATUSES.includes(status);
}

/** Motivo por el que el renglón no se puede corregir, o `null` si está pendiente y se puede corregir. */
export function correctionLockReason(
  item: TransportDeliveryReceiptItemResponse,
  requestStatus: TransportRequestStatus | null | undefined,
): string | null {
  if (!isRequestOpenForCorrections(requestStatus)) {
    return `La solicitud CO-31 está ${requestStatus}; ya no se pueden corregir sus renglones.`;
  }
  if (item.deliveryConfirmed) return 'Este renglón ya fue entregado.';
  if ((item.internalReturnQuantity ?? 0) > 0) return 'Este renglón tiene devoluciones registradas.';
  return null;
}

/** Motivo por el que no se pueden marcar unidades como no encontradas, o `null` si se puede. */
export function notFoundLockReason(
  item: TransportDeliveryReceiptItemResponse,
  requestStatus: TransportRequestStatus | null | undefined,
): string | null {
  return correctionLockReason(item, requestStatus)
    ?? (notFoundRemaining(item) <= 0 ? 'Todas las unidades del renglón ya están marcadas como no encontradas.' : null);
}

/** El único renglón no se elimina: se anula o cancela la solicitud. */
export function removalLockReason(receipt: TransportDeliveryReceiptResponse): string | null {
  return receipt.items.length <= 1
    ? 'Es el único renglón. Si ya no se necesita nada, anula o cancela la solicitud CO-31.'
    : null;
}

function parseQuantity(value: unknown): number | null | undefined {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return null;
  const quantity = Number(value);
  return Number.isFinite(quantity) ? quantity : undefined;
}

/** Formato que acepta el backend: hasta 16 dígitos enteros y 2 decimales. */
function quantityFormatError(quantity: number): string | null {
  if (Math.trunc(quantity) >= 10 ** CORRECTION_QUANTITY_MAX_INTEGER_DIGITS) {
    return `La cantidad admite hasta ${CORRECTION_QUANTITY_MAX_INTEGER_DIGITS} dígitos enteros.`;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(String(quantity))) return 'La cantidad admite hasta dos decimales.';
  return null;
}

/**
 * Valida la nueva cantidad: obligatoria, > 0 (con 0 se sugiere eliminar el renglón), hasta 2 decimales y
 * 16 dígitos enteros, no menor que las unidades no encontradas y distinta de la actual.
 */
export function validateCorrectionQuantity(value: unknown, item: TransportDeliveryReceiptItemResponse): string | null {
  const quantity = parseQuantity(value);
  if (quantity === null) return 'Indica la nueva cantidad.';
  if (quantity === undefined) return 'Indica una cantidad válida.';
  if (quantity === 0) return 'La cantidad debe ser mayor que cero. Para quitar el artículo usa «Eliminar renglón».';
  if (quantity < 0) return 'La cantidad debe ser mayor que cero.';
  const formatError = quantityFormatError(quantity);
  if (formatError) return formatError;
  const notFound = notFoundOf(item);
  if (quantity < notFound) {
    return `No puede ser menor que las ${formatQuantity(notFound)} unidades marcadas como no encontradas.`;
  }
  if (quantity === item.quantity) return 'La nueva cantidad es igual a la actual.';
  return null;
}

/** Valida las unidades no encontradas: entre 0,01 y `quantity - notFoundQuantity`, hasta 2 decimales. */
export function validateNotFoundQuantity(value: unknown, item: TransportDeliveryReceiptItemResponse): string | null {
  const quantity = parseQuantity(value);
  if (quantity === null) return 'Indica cuántas unidades no se encontraron.';
  if (quantity === undefined) return 'Indica una cantidad válida.';
  if (quantity <= 0) return 'La cantidad debe ser mayor que cero.';
  const formatError = quantityFormatError(quantity);
  if (formatError) return formatError;
  const remaining = notFoundRemaining(item);
  if (quantity > remaining) {
    return `Como máximo ${formatQuantity(remaining)} (solicitadas menos las ya marcadas como no encontradas).`;
  }
  return null;
}

/** Valida la cantidad del modal según el tipo de corrección (eliminar no lleva cantidad). */
export function validateCorrectionDialogQuantity(
  type: ReceiptItemCorrectionType,
  value: unknown,
  item: TransportDeliveryReceiptItemResponse,
): string | null {
  if (type === 'QUANTITY_CHANGE') return validateCorrectionQuantity(value, item);
  if (type === 'NOT_FOUND') return validateNotFoundQuantity(value, item);
  return null;
}

/** Texto para el usuario según las unidades pendientes de ajuste manual (positivo: faltan; negativo: sobran). */
export function manualPendingMessage(pendingManualQuantity: number): string | null {
  if (pendingManualQuantity > 0) {
    return `Faltan ${formatQuantity(pendingManualQuantity)} unidades. Regístralas después con un ajuste de inventario positivo de este artículo.`;
  }
  if (pendingManualQuantity < 0) {
    return `${formatQuantity(-pendingManualQuantity)} unidades siguen asignadas a esta solicitud. Registra su devolución o un ajuste negativo.`;
  }
  return null;
}

/** Estimación previa (en el modal) de lo que quedará pendiente si se elige el modo manual. */
export function estimateManualPending(
  item: TransportDeliveryReceiptItemResponse,
  type: ReceiptItemCorrectionType,
  newQuantity: number | null,
): number {
  if (type === 'LINE_REMOVAL') return -allocatedOf(item);
  if (newQuantity === null || !Number.isFinite(newQuantity)) return 0;
  if (type === 'NOT_FOUND') return -notFoundAllocatedImpact(item, Math.max(0, newQuantity));
  if (newQuantity > item.quantity) return newQuantity - item.quantity;
  return -Math.max(0, allocatedOf(item) - newQuantity);
}

/** Explicación del efecto del modo automático en el modal. */
export function automaticEffectMessage(
  item: TransportDeliveryReceiptItemResponse,
  type: ReceiptItemCorrectionType,
  newQuantity: number | null,
): string {
  if (type === 'NOT_FOUND') {
    if (newQuantity === null || !Number.isFinite(newQuantity) || newQuantity <= 0) {
      return 'Las unidades apartadas en bodega se descuentan de la existencia con un ajuste de inventario negativo; '
        + 'primero se descuentan las que no estaban asignadas.';
    }
    const impact = notFoundAllocatedImpact(item, newQuantity);
    return impact > 0
      ? `${formatQuantity(impact)} unidades apartadas en bodega se descontarán de la existencia con un ajuste de inventario negativo.`
      : 'Las unidades marcadas no estaban asignadas en bodega: no habrá movimiento de inventario.';
  }
  if (type === 'LINE_REMOVAL' || (newQuantity !== null && newQuantity < item.quantity)) {
    return 'Las unidades sobrantes vuelven a disponible en su bodega.';
  }
  return 'Se reserva la existencia disponible según la prioridad de bodegas; lo que no alcance queda sin existencia.';
}

/** Mensaje de resultado tras aplicar la corrección. */
export function correctionResultMessage(correction: ReceiptItemCorrectionResponse): string {
  const base = correction.type === 'LINE_REMOVAL'
    ? `Renglón ${correction.description} eliminado del CO-30 ${correction.receiptNumber} y del CO-31 ${correction.requestNumber}.`
    : correction.type === 'NOT_FOUND'
    ? `${formatQuantity(correction.notFoundQuantity ?? 0)} unidades de ${correction.description} marcadas como no encontradas`
      + ` (asignadas ${formatQuantity(correction.assignedBefore)} → ${formatQuantity(correction.assignedAfter)}).`
    : `Cantidad de ${correction.description}: ${formatQuantity(correction.quantityBefore)} → ${formatQuantity(correction.quantityAfter)}`
      + ` (asignadas ${formatQuantity(correction.assignedBefore)} → ${formatQuantity(correction.assignedAfter)}).`;
  const pending = correction.mode === 'MANUAL' ? manualPendingMessage(correction.pendingManualQuantity) : null;
  return pending ? `${base} ${pending}` : base;
}
