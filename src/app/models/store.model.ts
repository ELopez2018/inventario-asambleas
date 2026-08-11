export interface StoreResponse {
  id: number;
  description: string;
  address: string | null;
  gpsCoordinates: string | null;
  phone: string | null;
  priorityOrder: number;
  available: boolean;
}

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
