import { summarizeManualAllocation, validateManualAllocation } from './manual-allocation';

describe('manual allocation rules', () => {
  const available = new Map<number, number>([[2, 12], [5, 10]]);
  const label = (id: number) => `B${id}`;

  it('summarizes assigned and missing units without floating point errors', () => {
    expect(summarizeManualAllocation(20, [
      { sourceStoreId: 2, allocatedQuantity: 12 },
      { sourceStoreId: 5, allocatedQuantity: 6 },
    ])).toEqual({ requested: 20, assigned: 18, missing: 2 });
    expect(summarizeManualAllocation(0.3, [
      { sourceStoreId: 2, allocatedQuantity: 0.1 },
      { sourceStoreId: 5, allocatedQuantity: 0.2 },
    ]).missing).toBe(0);
  });

  it('accepts a partial allocation (the rest becomes a shortage)', () => {
    expect(validateManualAllocation(6, [{ sourceStoreId: 2, allocatedQuantity: 2 }], available, label))
      .toEqual([]);
  });

  it('rejects an empty MANUAL line', () => {
    expect(validateManualAllocation(6, [], available, label).length).toBe(1);
  });

  it('rejects missing store, non positive quantity and repeated store', () => {
    const errors = validateManualAllocation(20, [
      { sourceStoreId: null, allocatedQuantity: 1 },
      { sourceStoreId: 2, allocatedQuantity: 0 },
      { sourceStoreId: 5, allocatedQuantity: 3 },
      { sourceStoreId: 5, allocatedQuantity: 1 },
    ], available, label);

    expect(errors.some((e) => e.includes('Seleccione la bodega'))).toBeTrue();
    expect(errors.some((e) => e.includes('B2 debe ser mayor a 0'))).toBeTrue();
    expect(errors.some((e) => e.includes('B5 está repetida'))).toBeTrue();
  });

  it('rejects a store without stock, more than available and a sum above the request', () => {
    const errors = validateManualAllocation(10, [
      { sourceStoreId: 9, allocatedQuantity: 1 },
      { sourceStoreId: 2, allocatedQuantity: 13 },
    ], available, label);

    expect(errors.some((e) => e.includes('B9 no está disponible'))).toBeTrue();
    expect(errors.some((e) => e.includes('B2 solo tiene 12'))).toBeTrue();
    expect(errors.some((e) => e.includes('supera la cantidad solicitada'))).toBeTrue();
  });
});
