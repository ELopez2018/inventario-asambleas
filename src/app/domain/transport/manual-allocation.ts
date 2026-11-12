/** Reglas puras de la asignación manual de bodegas de un renglón del CO-31. */

export interface ManualAllocationLine {
  sourceStoreId: number | null;
  allocatedQuantity: number | null;
}

export interface ManualAllocationTotals {
  requested: number;
  assigned: number;
  /** Unidades pedidas que quedarían sin existencia (nunca negativo). */
  missing: number;
}

/** Trabaja en centésimas para evitar errores de coma flotante (las cantidades admiten 2 decimales). */
function cents(value: number | null | undefined): number {
  return Math.round((Number(value) || 0) * 100);
}

export function summarizeManualAllocation(
  requestedQuantity: number,
  lines: ManualAllocationLine[],
): ManualAllocationTotals {
  const requested = cents(requestedQuantity);
  const assigned = lines.reduce((sum, line) => sum + cents(line.allocatedQuantity), 0);
  return {
    requested: requested / 100,
    assigned: assigned / 100,
    missing: Math.max(requested - assigned, 0) / 100,
  };
}

/**
 * Valida un renglón MANUAL con las mismas reglas del backend. Devuelve mensajes para el usuario;
 * vacío si es válido. `availableByStore` es lo asignable por bodega (la bodega ausente no es elegible).
 */
export function validateManualAllocation(
  requestedQuantity: number,
  lines: ManualAllocationLine[],
  availableByStore: ReadonlyMap<number, number>,
  storeLabel: (storeId: number) => string,
): string[] {
  if (!lines.length) {
    return ['Agregue al menos una bodega o desactive la asignación manual.'];
  }

  const errors: string[] = [];
  const seen = new Set<number>();

  for (const line of lines) {
    if (line.sourceStoreId === null || line.sourceStoreId === undefined) {
      errors.push('Seleccione la bodega de cada asignación.');
      continue;
    }

    const label = storeLabel(line.sourceStoreId);

    if (seen.has(line.sourceStoreId)) {
      errors.push(`La bodega ${label} está repetida; sume sus cantidades en una sola asignación.`);
      continue;
    }
    seen.add(line.sourceStoreId);

    const quantity = cents(line.allocatedQuantity);
    if (quantity <= 0) {
      errors.push(`La cantidad de ${label} debe ser mayor a 0.`);
      continue;
    }

    const available = availableByStore.get(line.sourceStoreId);
    if (available === undefined) {
      errors.push(`La bodega ${label} no está disponible o no tiene existencia del artículo.`);
    } else if (quantity > cents(available)) {
      errors.push(`La bodega ${label} solo tiene ${available} disponibles.`);
    }
  }

  const totals = summarizeManualAllocation(requestedQuantity, lines);
  if (totals.assigned > totals.requested) {
    errors.push(
      `Lo asignado (${totals.assigned}) supera la cantidad solicitada (${totals.requested}).`,
    );
  }

  return errors;
}
