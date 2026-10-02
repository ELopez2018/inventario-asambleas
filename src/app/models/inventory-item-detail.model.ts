export type DetailItemStatus = 'INCOME' | 'LOAN' | 'RETURN' | 'TRANSFER' | 'DECOMMISSION' | 'EGRESS';

export interface InventoryItemDetailResponse {
  id: number;
  itemId: number;
  storeId: number;
  storeName: string;
  code: string;
  serial: string | null;
  physicalStateId: number;
  physicalStateTitle: string;
  physicalStateDescription: string | null;
  itemStatus: DetailItemStatus;
  unitTypeId: number;
  unitTypeTitle: string;
  observations: string | null;
}

export interface CreateInventoryItemDetailRequest {
  itemId: number;
  storeId: number;
  code: string;
  serial?: string | null;
  physicalStateId: number;
  itemStatus: DetailItemStatus;
  unitTypeId: number;
  observations?: string | null;
}

export type UpdateInventoryItemDetailRequest = CreateInventoryItemDetailRequest;
