export interface EventResponse {
  id: number;
  description: string;
  startDate: string | null;
  endDate: string | null;
  observations: string | null;
}

export interface CreateEventRequest {
  description: string;
  startDate?: string | null;
  endDate?: string | null;
  observations?: string | null;
}

export type UpdateEventRequest = CreateEventRequest;
