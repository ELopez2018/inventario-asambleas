export interface StoreOption {
  id: number;
  label: string;
}

// The backend currently does not expose stores endpoint; keep this catalog in sync with DB seed data.
export const STORE_OPTIONS: StoreOption[] = [
  { id: 1, label: 'ARMENIA' },
  { id: 2, label: 'MANIZALES' },
  { id: 3, label: 'PEREIRA - BODEGA 1' },
  { id: 4, label: 'PEREIRA - BODEGA 2' },
];
