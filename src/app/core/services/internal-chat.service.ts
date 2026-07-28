import { Injectable, computed, inject, signal } from '@angular/core';
import {
  ChatMessageResponse,
  ConnectedChatUserResponse,
  ConnectedChatUsersResponse,
} from '../../models/chat.model';
import { AuthService } from './auth.service';
import { RealtimeService } from './realtime.service';

@Injectable({ providedIn: 'root' })
export class InternalChatService {
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly selectedRecipientState = signal<ConnectedChatUserResponse | null>(null);
  private readonly messagesState = signal<ChatMessageResponse[]>([]);
  private readonly connectedUsersState = signal<ConnectedChatUsersResponse | null>(null);

  readonly messagesSnapshot = this.messagesState.asReadonly();
  readonly connectedUsersSnapshot = this.connectedUsersState.asReadonly();
  readonly messages$ = this.realtime.chatMessages$;
  readonly connectedUsers$ = this.realtime.connectedUsers$;
  readonly selectedRecipient = this.selectedRecipientState.asReadonly();
  readonly currentUserId = computed(() => this.auth.getCurrentUser()?.userId ?? null);
  readonly availableUsers = computed(() =>
    (this.connectedUsersState()?.users ?? []).filter(
      (user) => user.userId !== this.currentUserId(),
    ),
  );
  readonly selectedTitle = computed(() => this.selectedRecipientState()?.username ?? 'Todos');

  constructor() {
    this.realtime.chatMessages$.subscribe((message) => {
      this.messagesState.update((messages) => [...messages, message].slice(-200));
    });
    this.realtime.connectedUsers$.subscribe((users) => {
      this.connectedUsersState.set(users);

      const selected = this.selectedRecipientState();
      if (selected && !users?.users.some((user) => user.userId === selected.userId)) {
        this.selectAll();
      }
    });
  }

  selectAll(): void {
    this.selectedRecipientState.set(null);
  }

  selectUser(user: ConnectedChatUserResponse): void {
    this.selectedRecipientState.set(user);
  }

  send(content: string): void {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return;
    }

    this.realtime.sendChatMessage(trimmedContent, this.selectedRecipientState()?.userId ?? null);
  }
}
