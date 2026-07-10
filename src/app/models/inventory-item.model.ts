export interface InventoryItemResponse {
  id: number;
  description: string;
  quantity: number;
  ownerUserId: number;
  storeId: number;
  stateId: number;
}

export interface CreateInventoryItemRequest {
  description: string;
  quantity: number;
  ownerUserId: number;
  storeId: number;
  stateId: number;
}

export type UpdateInventoryItemRequest = CreateInventoryItemRequest;
