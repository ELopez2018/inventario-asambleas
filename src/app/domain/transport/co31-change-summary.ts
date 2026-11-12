import {
  TRANSPORT_REQUEST_RELEASE_STOCK_STATUSES,
  TransportRequestItemRequest,
  TransportRequestItemResponse,
  TransportRequestResponse,
  UpdateTransportRequestRequest,
} from '../../models/transport-request.model';
import {
  ConfirmationRow,
  ConfirmationSummary,
  EMPTY_VALUE,
  formatQuantity,
  formatText,
  normalizeNumber,
  normalizeText,
} from '../confirmation/confirmation-summary';

type GeneralField = Exclude<keyof UpdateTransportRequestRequest, 'items' | 'eventId'>;

const GENERAL_FIELDS: { key: GeneralField; label: string; kind?: 'time' | 'number' }[] = [
  { key: 'requestDate', label: 'Fecha de solicitud' },
  { key: 'status', label: 'Estado' },
  { key: 'requestedFrom', label: 'Solicitado por' },
  { key: 'requestedTo', label: 'Solicitado a' },
  { key: 'targetDepartment', label: 'Departamento destino' },
  { key: 'targetPlace', label: 'Lugar de entrega' },
  { key: 'desiredDate', label: 'Fecha deseada' },
  { key: 'desiredTime', label: 'Hora deseada', kind: 'time' },
  { key: 'estimatedAmount', label: 'Monto estimado', kind: 'number' },
  { key: 'observations', label: 'Observaciones' },
  { key: 'receivedBy', label: 'Recibido por' },
  { key: 'receivedDate', label: 'Fecha de recibido' },
  { key: 'receivedTime', label: 'Hora de recibido', kind: 'time' },
  { key: 'authorizedBy', label: 'Autorizado por' },
];

const CONTROL_TYPE_LABEL: Record<string, string> = { INDIVIDUAL: 'Individual', LOTE: 'Lote', KIT: 'Kit' };

export interface Co31ItemChange {
  kind: 'added' | 'removed' | 'modified';
  label: string;
  original?: TransportRequestItemResponse;
  next?: TransportRequestItemRequest;
}

export interface Co31Diff {
  generalRows: ConfirmationRow[];
  itemRows: ConfirmationRow[];
  itemChanges: Co31ItemChange[];
  statusChanged: boolean;
}

function normalizeGeneral(value: unknown, kind?: 'time' | 'number'): string | number | null {
  if (kind === 'number') return normalizeNumber(value as number | null);
  const text = normalizeText(value as string | null);
  return kind === 'time' && text ? text.slice(0, 5) : text;
}

function displayGeneral(value: string | number | null): string {
  return value === null ? EMPTY_VALUE : typeof value === 'number' ? formatQuantity(value) : value;
}

export function itemLabel(item: { id?: number | null; description: string }, lineNumber?: number): string {
  const line = lineNumber ? `Renglón ${lineNumber}` : 'Nuevo renglón';
  const id = item.id ? ` (ID ${item.id})` : '';
  return `${line}${id} · ${formatText(item.description)}`;
}

type StoreNameResolver = (storeId: number) => string;

function describeAllocation(
  mode: 'AUTO' | 'MANUAL',
  pairs: { storeId: number; quantity: number }[],
  storeName: StoreNameResolver,
): string {
  if (mode === 'AUTO') return 'Automática por prioridad';
  const detail = [...pairs]
    .sort((a, b) => a.storeId - b.storeId)
    .map((pair) => `${storeName(pair.storeId)} ${formatQuantity(pair.quantity)}`)
    .join(', ');
  return `Manual: ${detail || EMPTY_VALUE}`;
}

/** Cambio de modo o de bodegas elegidas; `null` si el renglón no cambia su asignación. */
function allocationChange(
  current: TransportRequestItemResponse,
  next: TransportRequestItemRequest,
  storeName: StoreNameResolver,
): { before: string; after: string } | null {
  if (!next.allocationMode) return null;

  const currentMode = current.allocationMode ?? 'AUTO';
  const toPairs = (list: { sourceStoreId: number | null; allocatedQuantity: number }[]) => list
    .filter((a) => a.sourceStoreId !== null)
    .map((a) => ({ storeId: a.sourceStoreId as number, quantity: Number(a.allocatedQuantity) }));
  const before = toPairs(current.allocations ?? []);
  const after = toPairs(next.allocations ?? []);
  const key = (pairs: { storeId: number; quantity: number }[]) => JSON.stringify(
    [...pairs].sort((a, b) => a.storeId - b.storeId).map((p) => [p.storeId, p.quantity]));

  if (currentMode === next.allocationMode && (next.allocationMode === 'AUTO' || key(before) === key(after))) {
    return null;
  }

  return {
    before: describeAllocation(currentMode, before, storeName),
    after: describeAllocation(next.allocationMode, after, storeName),
  };
}

/** Compara el CO-31 cargado con el cuerpo que se enviará en el PUT. */
export function diffTransportRequest(
  original: TransportRequestResponse,
  body: UpdateTransportRequestRequest,
  storeName: StoreNameResolver = (storeId) => `Bodega #${storeId}`,
): Co31Diff {
  const generalRows: ConfirmationRow[] = [];
  for (const field of GENERAL_FIELDS) {
    const before = normalizeGeneral(original[field.key], field.kind);
    const after = normalizeGeneral(body[field.key], field.kind);
    if (before !== after) {
      generalRows.push({ label: field.label, before: displayGeneral(before), after: displayGeneral(after) });
    }
  }

  const itemRows: ConfirmationRow[] = [];
  const itemChanges: Co31ItemChange[] = [];
  const sentIds = new Set(body.items.filter((item) => item.id).map((item) => item.id));

  for (const next of body.items) {
    if (!next.id) {
      const label = itemLabel(next);
      itemChanges.push({ kind: 'added', label, next });
      itemRows.push({ label, before: 'No solicitado', after: `Agregar ${formatQuantity(next.quantity)}` });
      continue;
    }
    const current = original.items.find((item) => item.id === next.id);
    if (!current) continue;
    const label = itemLabel(current, current.lineNumber);
    const rows: ConfirmationRow[] = [];
    if (Number(current.quantity) !== Number(next.quantity)) {
      rows.push({ label: `${label}, cantidad solicitada`, before: formatQuantity(current.quantity), after: formatQuantity(next.quantity) });
    }
    if (normalizeText(current.description) !== normalizeText(next.description)) {
      rows.push({ label: `${label}, descripción`, before: formatText(current.description), after: formatText(next.description) });
    }
    if (current.articleControlType !== (next.articleControlType ?? current.articleControlType)) {
      rows.push({
        label: `${label}, tipo de control`,
        before: CONTROL_TYPE_LABEL[current.articleControlType] ?? current.articleControlType,
        after: CONTROL_TYPE_LABEL[next.articleControlType!] ?? String(next.articleControlType),
      });
    }
    if (normalizeText(current.sizeAndWeight) !== normalizeText(next.sizeAndWeight)) {
      rows.push({ label: `${label}, tamaño/peso`, before: formatText(current.sizeAndWeight), after: formatText(next.sizeAndWeight) });
    }
    if (normalizeNumber(current.lineTotal) !== normalizeNumber(next.lineTotal)) {
      rows.push({ label: `${label}, total`, before: formatQuantity(current.lineTotal), after: formatQuantity(next.lineTotal) });
    }
    const allocation = allocationChange(current, next, storeName);
    if (allocation) {
      rows.push({ label: `${label}, asignación de bodegas`, ...allocation });
    }
    if (rows.length) {
      itemChanges.push({ kind: 'modified', label, original: current, next });
      itemRows.push(...rows);
    }
  }

  for (const current of original.items) {
    if (!sentIds.has(current.id)) {
      const label = itemLabel(current, current.lineNumber);
      itemChanges.push({ kind: 'removed', label, original: current });
      itemRows.push({ label, before: `Solicitado ${formatQuantity(current.quantity)}`, after: 'Quitar' });
    }
  }

  return { generalRows, itemRows, itemChanges, statusChanged: original.status !== body.status };
}

function shortageLines(items: TransportRequestItemResponse[]): string[] {
  return items
    .filter((item) => (item.unavailableQuantity ?? 0) > 0)
    .map((item) => `${itemLabel(item, item.lineNumber)}: solicitadas ${formatQuantity(item.quantity)}, `
      + `asignadas ${formatQuantity(item.allocatedQuantity ?? null)}, faltan ${formatQuantity(item.unavailableQuantity)}`
      + (item.inventoryAdjustmentNote ? ` ${item.inventoryAdjustmentNote}` : '') + '.');
}

/**
 * Construye el modal de confirmación de la edición del CO-31.
 * Devuelve `null` si no hay diferencias que guardar.
 */
export function buildCo31ConfirmationSummary(
  original: TransportRequestResponse,
  body: UpdateTransportRequestRequest,
  receiptNumber: string | null,
  storeName?: StoreNameResolver,
): ConfirmationSummary | null {
  const diff = diffTransportRequest(original, body, storeName);
  const rows = [...diff.itemRows, ...diff.generalRows];
  if (!rows.length) return null;

  const number = original.requestNumber;
  const deliversAll = diff.statusChanged && body.status === 'ENTREGADA';

  if (deliversAll) {
    const paragraphs = [
      'Si aceptas, la solicitud pasará a ENTREGADA y se confirmarán sus artículos asociados al CO-30. '
        + 'No podrás modificar sus renglones desde el CO-31 ni regresar a un estado anterior. '
        + 'Confirma únicamente si corresponde a la entrega física de todos los artículos. '
        + 'Si solo entregaste algunos, márcalos individualmente en CO-30.',
    ];
    const shortages = shortageLines(original.items);
    if (shortages.length) {
      paragraphs.push('Faltantes existentes (lo solicitado no equivale a lo asignado):', ...shortages);
    }
    return {
      title: `Confirmar entrega completa del CO-31 ${number}`,
      paragraphs,
      rows,
      confirmText: 'Sí, confirmar entrega completa',
      cancelText: 'Volver a revisar',
      danger: true,
    };
  }

  const paragraphs: string[] = [];
  const itemsChanged = diff.itemChanges.length > 0;

  if (!receiptNumber) {
    paragraphs.push('Si aceptas, se actualizará el CO-31 y se recalcularán sus reservas de inventario. '
      + 'Las bodegas asignadas y los faltantes pueden cambiar según la disponibilidad actual.');
  } else if (itemsChanged) {
    paragraphs.push(`Si aceptas, se guardarán los cambios del CO-31 ${number} y se actualizarán los `
      + `artículos pendientes del CO-30 ${receiptNumber}. Se recalcularán las asignaciones de los `
      + 'renglones modificados; esto puede cambiar las bodegas de origen y la disponibilidad. '
      + 'Los artículos ya entregados y sus devoluciones se conservarán.');
  } else {
    paragraphs.push('Si aceptas, se guardarán los datos generales que aparecen en el resumen. '
      + 'Se conservarán los artículos y sus asignaciones. Esta corrección no recalculará las existencias.');
  }

  for (const change of diff.itemChanges) {
    if (change.kind === 'modified' && change.original && change.next
      && Number(change.next.quantity) < Number(change.original.quantity)) {
      paragraphs.push(`Se reducirá la cantidad solicitada de ${change.label} de `
        + `${formatQuantity(change.original.quantity)} a ${formatQuantity(change.next.quantity)}. `
        + 'El inventario comprometido se recalculará según la asignación existente y la disponibilidad actual.');
    }
    if (change.kind === 'removed') {
      paragraphs.push(`${change.label} dejará de aparecer en los documentos activos y su asignación se liberará.`);
    }
    if (change.kind === 'added') {
      paragraphs.push(`Se creará el renglón de ${formatText(change.next?.description)} `
        + `(${formatQuantity(change.next?.quantity)}) y se asignará lo disponible; puede quedar con faltante.`);
    }
  }

  if (diff.statusChanged && TRANSPORT_REQUEST_RELEASE_STOCK_STATUSES.includes(body.status!)) {
    paragraphs.push(`La solicitud quedará finalizada como ${body.status} y no podrá reactivarse.`);
  }

  return {
    title: `Confirmar cambios en el CO-31 ${number}`,
    paragraphs,
    rows,
    confirmText: 'Aplicar cambios',
    cancelText: 'Volver a revisar',
  };
}

/**
 * Huella de los datos que condicionan la edición. Si cambia entre la carga y el guardado,
 * otro usuario modificó el registro (p. ej. confirmó una entrega).
 */
export function transportRequestFingerprint(request: TransportRequestResponse, receiptId: number | null): string {
  return JSON.stringify({
    receiptId,
    status: request.status,
    general: GENERAL_FIELDS.map((field) => normalizeGeneral(request[field.key], field.kind)),
    items: request.items.map((item) => [
      item.id, Number(item.quantity), normalizeText(item.description), item.articleControlType,
      !!item.deliveryConfirmed, item.allocations.reduce((sum, a) => sum + a.returnedQuantity, 0),
    ]),
  });
}
