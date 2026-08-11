export interface CatalogOption {
  id: number;
  code: string;
  label: string;
  description?: string;
}

export const INVENTORY_STATES: CatalogOption[] = [
  {
    id: 1,
    code: 'BUEN ESTADO',
    label: 'Buen estado',
    description: 'Articulo en buen estado',
  },
  {
    id: 2,
    code: 'MAL ESTADO',
    label: 'Mal estado',
    description: 'Articulo en mal estado',
  },
  {
    id: 3,
    code: 'SIN INFORMACION',
    label: 'Sin informacion',
    description: 'Estado no reportado por la fuente',
  },
  {
    id: 4,
    code: 'USADO',
    label: 'Usado',
    description: 'Articulo usado',
  },
];

export const INVENTORY_UNIT_TYPES: CatalogOption[] = [
  { id: 1, code: 'UNIDAD', label: 'Unidad' },
  { id: 2, code: 'CAJA', label: 'Caja' },
  { id: 3, code: 'BOLSA', label: 'Bolsa' },
  { id: 4, code: 'PAQUETE', label: 'Paquete' },
];
