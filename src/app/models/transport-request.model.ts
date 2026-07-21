export interface TransportRequestItemRequest {
  quantity: number;
  description: string;
  sizeAndWeight?: string | null;
  lineTotal?: number | null;
}

export interface CreateTransportRequestRequest {
  requestNumber: string;
  requestDate: string;
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
  eventId?: number | null;
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
}

export interface TransportRequestResponse {
  id: number;
  requestNumber: string;
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
