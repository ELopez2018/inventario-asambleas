import { TransportRequestResponse, UpdateTransportRequestRequest } from '../../models/transport-request.model';
import { buildCo31ConfirmationSummary, diffTransportRequest } from './co31-change-summary';

function request(): TransportRequestResponse {
  return {
    id: 1, requestNumber: '031', status: 'APROBADA', stockReserved: true, requestDate: '2026-11-08',
    requestedFrom: 'Logística', requestedTo: 'Transporte', targetDepartment: null, targetPlace: 'Salón A',
    desiredDate: null, desiredTime: '10:30:00', estimatedAmount: null, observations: null, receivedBy: null,
    receivedDate: null, receivedTime: null, authorizedBy: null, eventId: 4,
    items: [
      { id: 71, lineNumber: 1, quantity: 20, description: 'SILLA', sizeAndWeight: null, lineTotal: null,
        newItem: false, articleControlType: 'INDIVIDUAL', allocations: [], allocatedQuantity: 10,
        unavailableQuantity: 10, inventoryAdjustmentNote: '(-10 Falta inventario)' },
      { id: 72, lineNumber: 2, quantity: 5, description: 'SILLA', sizeAndWeight: null, lineTotal: null,
        newItem: false, articleControlType: 'INDIVIDUAL', allocations: [] },
    ],
  };
}

function bodyFrom(original: TransportRequestResponse): UpdateTransportRequestRequest {
  const { requestDate, status, requestedFrom, requestedTo, targetDepartment, targetPlace, desiredDate,
    estimatedAmount, observations, receivedBy, receivedDate, receivedTime, authorizedBy } = original;
  return {
    requestDate, status, requestedFrom, requestedTo, targetDepartment, targetPlace, desiredDate,
    desiredTime: '10:30:00', estimatedAmount, observations, receivedBy, receivedDate, receivedTime,
    authorizedBy, eventId: 4,
    items: original.items.map(({ id, quantity, description, sizeAndWeight, lineTotal, articleControlType }) =>
      ({ id, quantity, description, sizeAndWeight, lineTotal, articleControlType })),
  };
}

describe('CO-31 change summary', () => {
  it('returns null when nothing changed', () => {
    const original = request();
    expect(buildCo31ConfirmationSummary(original, bodyFrom(original), 'CO-30-1')).toBeNull();
  });

  it('identifies repeated descriptions by row ID and lists additions, removals and reductions', () => {
    const original = request();
    const body = bodyFrom(original);
    body.items[0].quantity = 10;
    body.items.splice(1, 1);
    body.items.push({ quantity: 2, description: 'MESA', articleControlType: 'LOTE' });
    body.targetPlace = 'Salón B';
    const diff = diffTransportRequest(original, body);
    expect(diff.itemChanges.map((c) => c.kind)).toEqual(['modified', 'added', 'removed']);
    expect(diff.itemRows[0].label).toContain('ID 71');
    expect(diff.itemRows.find((r) => r.after === 'Quitar')?.label).toContain('ID 72');
    expect(diff.generalRows).toEqual([{ label: 'Lugar de entrega', before: 'Salón A', after: 'Salón B' }]);

    const summary = buildCo31ConfirmationSummary(original, body, 'CO-30-1')!;
    const text = summary.paragraphs.join(' ');
    expect(text).toContain('se actualizarán los artículos pendientes del CO-30 CO-30-1');
    expect(text).toContain('de 20 a 10');
    expect(text).not.toContain('liberarán exactamente');
    expect(text).toContain('dejará de aparecer');
    expect(text).toContain('Se creará el renglón de MESA');
  });

  it('uses the general-only text when only general data changes with a CO-30', () => {
    const original = request();
    const body = bodyFrom(original);
    body.observations = 'Nueva';
    const summary = buildCo31ConfirmationSummary(original, body, 'CO-30-1')!;
    expect(summary.paragraphs[0]).toContain('no recalculará las existencias');
  });

  it('uses the reservation text when there is no CO-30', () => {
    const original = request();
    const body = bodyFrom(original);
    body.items[0].quantity = 12;
    const summary = buildCo31ConfirmationSummary(original, body, null)!;
    expect(summary.paragraphs[0]).toContain('se recalcularán sus reservas');
  });

  it('warns about full delivery and lists shortages', () => {
    const original = request();
    const body = bodyFrom(original);
    body.status = 'ENTREGADA';
    const summary = buildCo31ConfirmationSummary(original, body, 'CO-30-1')!;
    expect(summary.title).toBe('Confirmar entrega completa del CO-31 031');
    expect(summary.paragraphs.join(' ')).toContain('faltan 10');
  });

  it('lists the allocation mode and store changes of a row', () => {
    const original = request();
    original.items[0].allocationMode = 'MANUAL';
    original.items[0].allocations = [
      { id: 1, itemId: 1, itemDescription: 'SILLA', sourceStoreId: 2, sourceStoreName: 'MANIZALES', requestedQuantity: 12,
        allocatedQuantity: 12, pickedQuantity: 0, deliveredQuantity: 0, returnedQuantity: 0, status: 'PLANIFICADA' },
    ];
    const body = bodyFrom(original);
    body.items[0].allocationMode = 'MANUAL';
    body.items[0].allocations = [{ sourceStoreId: 2, allocatedQuantity: 12 }];
    expect(diffTransportRequest(original, body).itemRows).toEqual([]);

    body.items[0].allocations = [{ sourceStoreId: 2, allocatedQuantity: 8 }, { sourceStoreId: 5, allocatedQuantity: 4 }];
    const names: Record<number, string> = { 2: 'MANIZALES', 5: 'PEREIRA' };
    const rows = diffTransportRequest(original, body, (id) => names[id]).itemRows;
    expect(rows).toEqual([jasmine.objectContaining({
      label: jasmine.stringContaining('asignación de bodegas'),
      before: 'Manual: MANIZALES 12', after: 'Manual: MANIZALES 8, PEREIRA 4',
    })]);

    body.items[0].allocationMode = 'AUTO';
    delete body.items[0].allocations;
    expect(diffTransportRequest(original, body).itemRows[0].after).toBe('Automática por prioridad');
  });
});
