export interface InventoryItemStoreStock {
  storeId: number;
  storeName: string;
  quantity: number;
}

export interface InventoryItemStoreStockRequest {
  storeId: number;
  quantity: number;
}

export interface InventoryItemResponse {
  id: number;
  description: string;
  ownerUserId: number;
  stateId: number;
  stateTitle: string;
  stateDescription: string | null;
  storeStocks: InventoryItemStoreStock[];
}

export interface CreateInventoryItemRequest {
  description: string;
  ownerUserId: number;
  stateId: number;
  storeStocks: InventoryItemStoreStockRequest[];
}

export type UpdateInventoryItemRequest = CreateInventoryItemRequest;

export interface MergeInventoryItemRequest {
  sourceItemId: number;
}
