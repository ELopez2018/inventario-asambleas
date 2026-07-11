import { INVENTORY_STORES } from './catalogs.constants';

export interface StoreOption {
  id: number;
  label: string;
}

// The backend currently does not expose stores endpoint; keep this catalog in sync with DB seed data.
export const STORE_OPTIONS: StoreOption[] = INVENTORY_STORES.map(({ id, code }) => ({
  id,
  label: code,
}));
