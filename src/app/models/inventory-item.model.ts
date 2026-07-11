export interface InventoryItemStoreStock {
  storeId: number;
  storeName?: string | null;
  quantity: number;
}

export interface InventoryItemResponse {
  id: number;
  description: string;
  ownerUserId: number;
  stateId: number;
  storeStocks: InventoryItemStoreStock[];
}

export interface CreateInventoryItemRequest {
  description: string;
  ownerUserId: number;
  stateId: number;
  storeStocks: InventoryItemStoreStock[];
}

export type UpdateInventoryItemRequest = CreateInventoryItemRequest;
