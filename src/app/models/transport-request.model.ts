export type TransportRequestStatus =
  | 'SOLICITADA'
  | 'APROBADA'
  | 'EN_TRANSITO'
  | 'ENTREGADA'
  | 'ANULADA'
  | 'DEVUELTA'
  | 'REGRESADA'
  | 'CANCELADA'
  | 'RECHAZADA'
  | 'CERRADA';

export const TRANSPORT_REQUEST_RELEASE_STOCK_STATUSES: TransportRequestStatus[] = [
  'ANULADA',
  'DEVUELTA',
  'REGRESADA',
  'CANCELADA',
  'RECHAZADA',
  'CERRADA',
];

export type ArticleControlType = 'INDIVIDUAL' | 'LOTE' | 'KIT';

export type TransportAllocationStatus =
  | 'PLANIFICADA'
  | 'PARCIAL'
  | 'SIN_EXISTENCIA'
  | 'ITEM_NUEVO'
  | 'RECOGIDA'
  | 'ENTREGADA'
  | 'DEVUELTA';

export interface TransportRequestItemAllocationRequest {
  sourceStoreId: number;
  allocatedQuantity: number;
}

export interface TransportRequestItemRequest {
  id?: number | null;
  quantity: number;
  description: string;
  sizeAndWeight?: string | null;
  lineTotal?: number | null;
  articleControlType?: ArticleControlType;
  /** Por defecto AUTO: el backend surte por prioridad de bodegas. */
  allocationMode?: AllocationMode;
  /** Solo se envía con `allocationMode = 'MANUAL'`; en AUTO el backend la ignora. */
  allocations?: TransportRequestItemAllocationRequest[];
}

export type AllocationMode = 'AUTO' | 'MANUAL';

export interface AllocationPreviewRequest {
  /** Solo al editar un CO-31 existente, para contar como disponible lo que ya reservó. */
  transportRequestId?: number | null;
  items: { description: string; quantity: number }[];
}

export interface AllocationPreviewAllocation {
  sourceStoreId: number | null;
  sourceStoreName: string | null;
  requestedQuantity: number;
  allocatedQuantity: number;
  status: TransportAllocationStatus;
}

export interface AllocationPreviewResponse {
  items: {
    description: string;
    quantity: number;
    newItem: boolean;
    allocations: AllocationPreviewAllocation[];
    allocatedQuantity: number;
    unavailableQuantity: number;
  }[];
}

export interface CreateTransportRequestRequest {
  requestDate: string;
  status?: TransportRequestStatus | null;
  requestedFrom: string;
  requestedTo: string;
  targetDepartment?: string | null;
  targetPlace?: string | null;
  desiredDate?: string | null;
  desiredTime?: string | null;
  estimatedAmount?: number | null;
  observations?: string | null;
  receivedBy?: string | null;
  receivedDate?: string | null;
  receivedTime?: string | null;
  authorizedBy?: string | null;
  eventId: number;
  items: TransportRequestItemRequest[];
}

export type UpdateTransportRequestRequest = CreateTransportRequestRequest;

export interface TransportRequestItemResponse {
  id: number;
  lineNumber: number;
  quantity: number;
  description: string;
  sizeAndWeight: string | null;
  lineTotal: number | null;
  newItem: boolean;
  articleControlType: ArticleControlType;
  /** Ausente en respuestas antiguas: se trata como AUTO. */
  allocationMode?: AllocationMode;
  allocations: TransportRequestItemAllocationResponse[];
  allocatedQuantity?: number;
  unavailableQuantity?: number;
  /** Unidades marcadas como no encontradas desde el CO-30 (0 si no hay). */
  notFoundQuantity?: number;
  inventoryAdjustmentNote?: string | null;
  inventoryAdjustmentReason?: string | null;
  deliveryConfirmed?: boolean;
}

export interface TransportRequestItemAllocationResponse {
  id: number;
  itemId: number | null;
  itemDescription: string | null;
  sourceStoreId: number | null;
  sourceStoreName: string | null;
  requestedQuantity: number;
  allocatedQuantity: number;
  pickedQuantity: number;
  deliveredQuantity: number;
  returnedQuantity: number;
  status: TransportAllocationStatus;
}

export interface TransportRequestNextNumberResponse {
  requestNumber: string;
}

export interface TransportRequestAutocompleteOptionsResponse {
  requestedFrom: string[];
  targetDepartments: string[];
}

export interface TransportRequestResponse {
  id: number;
  requestNumber: string;
  status: TransportRequestStatus;
  stockReserved: boolean;
  requestDate: string;
  requestedFrom: string;
  requestedTo: string;
  targetDepartment: string | null;
  targetPlace: string | null;
  desiredDate: string | null;
  desiredTime: string | null;
  estimatedAmount: number | null;
  observations: string | null;
  receivedBy: string | null;
  receivedDate: string | null;
  receivedTime: string | null;
  authorizedBy: string | null;
  eventId: number | null;
  items: TransportRequestItemResponse[];
}
