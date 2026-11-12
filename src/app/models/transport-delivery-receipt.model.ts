export interface CreateTransportDeliveryReceiptRequest {
  observations?: string | null;
}

export interface UpdateTransportDeliveryReceiptRequest {
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerAddress?: string | null;
  observations?: string | null;
  returnDeliveredTo?: string | null;
  returnDate?: string | null;
  returnReceivedBy?: string | null;
  items?: UpdateTransportDeliveryReceiptItemRequest[];
}

export interface UpdateTransportDeliveryReceiptItemRequest {
  id: number;
  assignedTo?: string | null;
  internalReturnQuantity?: number | null;
  internalReturnDate?: string | null;
  conditionNotes?: string | null;
}

export interface TransportDeliveryReceiptItemResponse {
  id: number;
  transportRequestItemId: number | null;
  lineNumber: number;
  articleNumber: string;
  articleControlType: 'INDIVIDUAL' | 'LOTE' | 'KIT';
  description: string;
  assignedTo: string | null;
  requestNumber: string;
  quantity: number;
  internalReturnQuantity: number | null;
  internalReturnDate: string | null;
  conditionNotes: string | null;
  allocatedQuantity?: number;
  /** Solo el faltante por inventario: `quantity - notFoundQuantity - allocatedQuantity`. */
  unavailableQuantity?: number;
  /** Unidades marcadas como no encontradas (0 si no hay). */
  notFoundQuantity?: number;
  inventoryAdjustmentNote?: string | null;
  inventoryAdjustmentReason?: string | null;
  deliveryConfirmed?: boolean;
}

export interface TransportDeliveryReceiptResponse {
  id: number;
  receiptNumber: string;
  transportRequestId: number;
  transportRequestNumber: string;
  receiptDate: string;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerAddress: string | null;
  observations: string | null;
  receivedBy: string | null;
  returnDeliveredTo: string | null;
  returnDate: string | null;
  returnReceivedBy: string | null;
  items: TransportDeliveryReceiptItemResponse[];
}

export type ReceiptItemCorrectionType = 'QUANTITY_CHANGE' | 'LINE_REMOVAL' | 'NOT_FOUND';
export type ReceiptItemCorrectionStockMode = 'AUTOMATIC' | 'MANUAL';

export interface CorrectReceiptItemQuantityRequest {
  quantity: number;
  stockMode: ReceiptItemCorrectionStockMode;
  reason: string;
}

export interface RemoveReceiptItemRequest {
  stockMode: ReceiptItemCorrectionStockMode;
  reason: string;
}

/** Unidades que no se encontraron en esta ocasión (se acumulan con las marcas anteriores). */
export interface MarkReceiptItemNotFoundRequest {
  quantity: number;
  stockMode: ReceiptItemCorrectionStockMode;
  reason: string;
}

export interface ReceiptItemCorrectionResponse {
  id: number;
  receiptId: number;
  receiptNumber: string;
  receiptItemId: number;
  requestId: number;
  requestNumber: string;
  requestItemId: number;
  description: string;
  type: ReceiptItemCorrectionType;
  mode: ReceiptItemCorrectionStockMode;
  quantityBefore: number;
  quantityAfter: number;
  assignedBefore: number;
  assignedAfter: number;
  pendingManualQuantity: number;
  /** Unidades marcadas en esta corrección; solo distinto de 0 en `NOT_FOUND`. */
  notFoundQuantity?: number;
  reason: string;
  createdAt: string;
  createdByUserId: number | null;
}

export interface ReceiptItemCorrectionResultResponse {
  correction: ReceiptItemCorrectionResponse;
  receipt: TransportDeliveryReceiptResponse;
}
