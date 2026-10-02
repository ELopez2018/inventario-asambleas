export interface InventoryItemStoreStock {
  storeId: number;
  storeName: string;
  /** Alias de availableQuantity, conservado por compatibilidad con el API. */
  quantity: number;
  existenceQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  inUseQuantity: number;
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
  existenceQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  inUseQuantity: number;
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
