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
