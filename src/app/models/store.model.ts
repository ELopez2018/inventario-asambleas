export interface StoreResponse {
  id: number;
  description: string;
  address: string | null;
  gpsCoordinates: string | null;
  phone: string | null;
  priorityOrder: number;
  available: boolean;
}

export interface CreateStoreRequest {
  description: string;
  address: string;
  gpsCoordinates?: string | null;
  phone?: string | null;
  priorityOrder?: number | null;
}

export interface UpdateStoreRequest {
  description: string;
  address: string;
  gpsCoordinates?: string | null;
  phone?: string | null;
}

export const STORE_DESCRIPTION_MAX_LENGTH = 255;
export const STORE_ADDRESS_MAX_LENGTH = 255;
export const STORE_GPS_MAX_LENGTH = 120;
export const STORE_PHONE_MAX_LENGTH = 30;

export interface StorePriorityUpdateRequest {
  priorityOrder: number;
}

export function compareStoresByPriority(a: StoreResponse, b: StoreResponse): number {
  const aPriority = Number.isFinite(a.priorityOrder) ? a.priorityOrder : Number.MAX_SAFE_INTEGER;
  const bPriority = Number.isFinite(b.priorityOrder) ? b.priorityOrder : Number.MAX_SAFE_INTEGER;
  const priorityComparison = aPriority - bPriority;

  if (priorityComparison !== 0) {
    return priorityComparison;
  }

  return a.description.localeCompare(b.description, 'es-CO');
}
