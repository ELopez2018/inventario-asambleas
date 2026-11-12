export interface InventoryAdjustmentRequest {
  storeId: number;
  quantityDelta: number;
  reason: string;
}

export interface InventoryAdjustmentResponse extends InventoryAdjustmentRequest {
  id: number;
  itemId: number;
  existenceBefore: number;
  existenceAfter: number;
  createdAt: string;
  createdByUserId: number | null;
  impacts: {
    requestId: number;
    requestNumber: string;
    receiptId: number | null;
    receiptNumber: string | null;
    requestItemId: number;
    allocationId: number;
    allocatedBefore: number;
    allocatedAfter: number;
  }[];
}
