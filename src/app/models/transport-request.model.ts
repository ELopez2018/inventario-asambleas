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

export interface TransportRequestItemRequest {
  quantity: number;
  description: string;
  sizeAndWeight?: string | null;
  lineTotal?: number | null;
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
