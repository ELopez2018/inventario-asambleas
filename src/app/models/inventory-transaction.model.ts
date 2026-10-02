export type MovementType = 'INCOME' | 'LOAN' | 'RETURN' | 'TRANSFER' | 'DECOMMISSION' | 'EGRESS';

export interface InventoryTransactionResponse {
  id: number;
  itemId: number;
  quantity: number;
  movementType: MovementType;
  movedByUserId: number;
  sourceStoreId: number | null;
  destinationStoreId: number | null;
  origin: string | null;
  destination: string | null;
  responsibleUserId: number;
  receivedByUserId: number | null;
  conditionNotes: string | null;
  movementDate: string;
  eventId: number;
}

export interface CreateInventoryTransactionRequest {
  itemId: number;
  quantity: number;
  movementType: MovementType;
  sourceStoreId?: number | null;
  destinationStoreId?: number | null;
  origin?: string | null;
  destination?: string | null;
  responsibleUserId: number;
  receivedByUserId?: number | null;
  conditionNotes?: string | null;
  movementDate: string;
  eventId: number;
}

export type UpdateInventoryTransactionRequest = CreateInventoryTransactionRequest;
