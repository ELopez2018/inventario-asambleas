export interface InventoryItemDetailPhotoConfigResponse {
  id: number;
  eventId: number;
  storeId: number;
  itemDetailId: number;
  locationLabel: string;
  referenceLatitude: number;
  referenceLongitude: number;
  gpsRadiusMeters: number;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId: number | null;
  updatedByUserId: number | null;
}

export interface CreateInventoryItemDetailPhotoConfigRequest {
  eventId: number;
  storeId: number;
  itemDetailId: number;
  locationLabel: string;
  referenceLatitude: number;
  referenceLongitude: number;
  gpsRadiusMeters?: number;
  observations?: string | null;
}

export interface UpdateInventoryItemDetailPhotoConfigRequest {
  eventId: number;
  storeId: number;
  itemDetailId: number;
  locationLabel: string;
  referenceLatitude: number;
  referenceLongitude: number;
  gpsRadiusMeters: number;
  observations?: string | null;
}

export interface InventoryItemDetailPhotoResponse {
  id: number;
  configId: number;
  eventId: number;
  storeId: number;
  itemDetailId: number;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  gpsLatitude: number;
  gpsLongitude: number;
  distanceToReferenceMeters: number;
  capturedAt: string;
  observations: string | null;
  contentUrl: string;
  createdAt: string;
  updatedAt: string;
  createdByUserId: number | null;
  updatedByUserId: number | null;
}

export interface UpdateInventoryItemDetailPhotoRequest {
  gpsLatitude: number;
  gpsLongitude: number;
  capturedAt?: string | null;
  observations?: string | null;
}

export interface UploadInventoryItemDetailPhotosPayload {
  eventId: number;
  storeId: number;
  itemDetailId: number;
  gpsLatitude: number;
  gpsLongitude: number;
  capturedAt?: string;
  observations?: string;
  files: File[];
}
