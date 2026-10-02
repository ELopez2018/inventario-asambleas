export interface StoreOrderReportRow {
  transportRequestId: number;
  deliveryReceiptId: number;
  receiptDate: string;
  description: string;
  quantity: number;
  co30FormNumber: string;
  responsible: string;
}

export interface StoreOrdersReport {
  storeId: number;
  storeName: string;
  totalQuantity: number;
  orders: StoreOrderReportRow[];
}
