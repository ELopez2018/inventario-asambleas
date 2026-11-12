import {
  ReceiptItemCorrectionResponse,
  TransportDeliveryReceiptItemResponse,
  TransportDeliveryReceiptResponse,
} from '../../models/transport-delivery-receipt.model';
import {
  correctionLockReason,
  correctionResultMessage,
  estimateManualPending,
  isRequestOpenForCorrections,
  manualPendingMessage,
  notFoundAllocatedImpact,
  notFoundLockReason,
  removalLockReason,
  validateCorrectionQuantity,
  validateNotFoundQuantity,
} from './co30-item-correction';

function item(overrides: Partial<TransportDeliveryReceiptItemResponse> = {}): TransportDeliveryReceiptItemResponse {
  return {
    id: 301, transportRequestItemId: 1, lineNumber: 1, articleNumber: 'A-1', articleControlType: 'LOTE',
    description: 'SILLA', assignedTo: null, requestNumber: 'A', quantity: 8, internalReturnQuantity: null,
    internalReturnDate: null, conditionNotes: null, allocatedQuantity: 8, deliveryConfirmed: false,
    ...overrides,
  };
}

function receipt(items: TransportDeliveryReceiptItemResponse[]): TransportDeliveryReceiptResponse {
  return {
    id: 30, receiptNumber: '300', transportRequestId: 10, transportRequestNumber: '55', receiptDate: '2026-11-09',
    ownerName: null, ownerPhone: null, ownerAddress: null, observations: null, receivedBy: null,
    returnDeliveredTo: null, returnDate: null, returnReceivedBy: null, items,
  };
}

describe('co30-item-correction', () => {
  it('solo permite corregir con el CO-31 en curso', () => {
    expect(isRequestOpenForCorrections('APROBADA')).toBeTrue();
    expect(isRequestOpenForCorrections(null)).toBeTrue();
    expect(isRequestOpenForCorrections('ENTREGADA')).toBeFalse();
    expect(isRequestOpenForCorrections('CANCELADA')).toBeFalse();
  });

  it('bloquea renglones entregados o con devoluciones', () => {
    expect(correctionLockReason(item(), 'APROBADA')).toBeNull();
    expect(correctionLockReason(item({ deliveryConfirmed: true }), 'APROBADA')).toContain('entregado');
    expect(correctionLockReason(item({ internalReturnQuantity: 1 }), 'APROBADA')).toContain('devoluciones');
    expect(correctionLockReason(item(), 'ENTREGADA')).toContain('ENTREGADA');
  });

  it('no permite eliminar el único renglón', () => {
    expect(removalLockReason(receipt([item()]))).toContain('único renglón');
    expect(removalLockReason(receipt([item(), item({ id: 302 })]))).toBeNull();
  });

  it('valida la nueva cantidad', () => {
    expect(validateCorrectionQuantity('', item())).not.toBeNull();
    expect(validateCorrectionQuantity(0, item())).toContain('Eliminar renglón');
    expect(validateCorrectionQuantity(-1, item())).toContain('mayor que cero');
    expect(validateCorrectionQuantity(1.234, item())).toContain('dos decimales');
    expect(validateCorrectionQuantity(1e16, item())).toContain('16 dígitos');
    expect(validateCorrectionQuantity(8, item())).toContain('igual');
    expect(validateCorrectionQuantity('6.5', item())).toBeNull();
    expect(validateCorrectionQuantity(2, item({ notFoundQuantity: 3 }))).toContain('no encontradas');
  });

  it('valida las unidades no encontradas contra lo pendiente por marcar', () => {
    const partial = item({ quantity: 5, notFoundQuantity: 2 });
    expect(validateNotFoundQuantity('', partial)).not.toBeNull();
    expect(validateNotFoundQuantity(0, partial)).toContain('mayor que cero');
    expect(validateNotFoundQuantity(0.001, partial)).toContain('dos decimales');
    expect(validateNotFoundQuantity(4, partial)).toContain('Como máximo 3');
    expect(validateNotFoundQuantity(3, partial)).toBeNull();
  });

  it('bloquea marcar no encontradas si ya no quedan unidades', () => {
    expect(notFoundLockReason(item(), 'APROBADA')).toBeNull();
    expect(notFoundLockReason(item({ notFoundQuantity: 8 }), 'APROBADA')).toContain('ya están marcadas');
    expect(notFoundLockReason(item({ deliveryConfirmed: true }), 'APROBADA')).toContain('entregado');
  });

  it('descuenta primero las unidades sin existencia al marcar no encontradas', () => {
    const short = item({ quantity: 5, allocatedQuantity: 3, unavailableQuantity: 2 });
    expect(notFoundAllocatedImpact(short, 2)).toBe(0);
    expect(notFoundAllocatedImpact(short, 4)).toBe(2);
    expect(estimateManualPending(short, 'NOT_FOUND', 4)).toBe(-2);
  });

  it('estima lo pendiente en modo manual', () => {
    expect(estimateManualPending(item(), 'QUANTITY_CHANGE', 10)).toBe(2);
    expect(estimateManualPending(item(), 'QUANTITY_CHANGE', 6)).toBe(-2);
    expect(estimateManualPending(item({ allocatedQuantity: 5 }), 'QUANTITY_CHANGE', 6)).toBe(0);
    expect(estimateManualPending(item(), 'LINE_REMOVAL', null)).toBe(-8);
  });

  it('describe las unidades pendientes de ajuste manual', () => {
    expect(manualPendingMessage(2)).toContain('Faltan 2 unidades');
    expect(manualPendingMessage(-3)).toContain('3 unidades siguen asignadas');
    expect(manualPendingMessage(0)).toBeNull();
  });

  it('arma el mensaje de resultado', () => {
    const correction: ReceiptItemCorrectionResponse = {
      id: 15, receiptId: 30, receiptNumber: '300', receiptItemId: 301, requestId: 10, requestNumber: '55',
      requestItemId: 1, description: 'SILLA', type: 'QUANTITY_CHANGE', mode: 'MANUAL', quantityBefore: 8,
      quantityAfter: 10, assignedBefore: 8, assignedAfter: 8, pendingManualQuantity: 2,
      reason: 'Faltaron dos sillas', createdAt: '2026-11-09T10:15:00', createdByUserId: 1,
    };
    expect(correctionResultMessage(correction)).toContain('8 → 10');
    expect(correctionResultMessage(correction)).toContain('Faltan 2 unidades');
    expect(correctionResultMessage({
      ...correction, type: 'NOT_FOUND', mode: 'AUTOMATIC', quantityAfter: 8, assignedAfter: 5,
      pendingManualQuantity: 0, notFoundQuantity: 3,
    })).toContain('3 unidades de SILLA marcadas como no encontradas');
  });
});
