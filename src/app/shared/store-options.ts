export interface StoreOption {
  id: number;
  label: string;
}

// The backend currently does not expose stores endpoint; keep this catalog in sync with DB seed data.
export const STORE_OPTIONS: StoreOption[] = [
  { id: 1, label: 'Almacen 1' },
  { id: 2, label: 'Almacen 2' },
];
