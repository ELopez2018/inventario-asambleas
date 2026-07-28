import type { RoleCode } from './auth.model';

export type ChatConversationScope = 'ALL' | 'PRIVATE';
export type ChatMessageType = 'MESSAGE' | 'PRIVATE';

export interface ChatMessageRequest {
  content: string;
  recipientUserId?: number | null;
}

export interface ChatMessageResponse {
  senderUserId: number;
  senderUsername: string;
  recipientUserId: number | null;
  recipientUsername: string | null;
  content: string;
  sentAt: string;
  type: ChatMessageType;
}

export interface ConnectedChatUserResponse {
  userId: number;
  username: string;
  roles: RoleCode[];
  sessionCount: number;
  connectedAt: string;
}

export interface ConnectedChatUsersResponse {
  users: ConnectedChatUserResponse[];
  totalUsers: number;
  updatedAt: string;
}
