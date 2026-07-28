import { Injectable, computed, inject, signal } from '@angular/core';
import {
  ChatMessageResponse,
  ConnectedChatUserResponse,
  ConnectedChatUsersResponse,
} from '../../models/chat.model';
import { AuthService } from './auth.service';
import { RealtimeService } from './realtime.service';
import { ChatNotificationService } from './chat-notification.service';
import { getUserInitials } from '../../shared/user-initials.util';

@Injectable({ providedIn: 'root' })
export class InternalChatService {
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly chatNotification = inject(ChatNotificationService);
  private readonly selectedRecipientState = signal<ConnectedChatUserResponse | null>(null);
  private readonly messagesState = signal<ChatMessageResponse[]>([]);
  private readonly connectedUsersState = signal<ConnectedChatUsersResponse | null>(null);
  private readonly isOpenState = signal(false);
  private knownConnections = new Map<number, number>();
  private initializedConnections = false;

  readonly messagesSnapshot = this.messagesState.asReadonly();
  readonly connectedUsersSnapshot = this.connectedUsersState.asReadonly();
  readonly messages$ = this.realtime.chatMessages$;
  readonly connectedUsers$ = this.realtime.connectedUsers$;
  readonly selectedRecipient = this.selectedRecipientState.asReadonly();
  readonly isOpen = this.isOpenState.asReadonly();
  readonly currentUserId = computed(() => this.auth.getCurrentUser()?.userId ?? null);
  // La guia exige mostrar todos los usuarios conectados (incluido el actual).
  // El chat privado consigo mismo se deshabilita, no se oculta.
  readonly connectedUsers = computed(() => this.connectedUsersState()?.users ?? []);
  readonly totalConnectedUsers = computed(
    () => this.connectedUsersState()?.totalUsers ?? this.connectedUsers().length,
  );
  readonly selectedTitle = computed(() => this.selectedRecipientState()?.username ?? 'Todos');

  constructor() {
    this.realtime.chatMessages$.subscribe((message) => {
      this.messagesState.update((messages) => [...messages, message].slice(-200));

      // Mostrar notificacion si el chat está cerrado
      if (!this.isOpenState() && message.senderUserId !== 0) {
        // No mostrar notificaciones de mensajes del sistema (senderUserId === 0)
        this.chatNotification.showMessageNotification(message);
      }
    });
    this.realtime.connectedUsers$.subscribe((users) => {
      this.handleConnectedUsersUpdate(users);
      this.connectedUsersState.set(users);

      const selected = this.selectedRecipientState();
      if (selected && !users?.users.some((user) => user.userId === selected.userId)) {
        this.selectAll();
      }
    });
  }

  private handleConnectedUsersUpdate(users: ConnectedChatUsersResponse | null): void {
    if (!users) {
      this.knownConnections.clear();
      this.initializedConnections = false;
      return;
    }

    const nextConnections = new Map<number, number>();

    for (const user of users.users) {
      nextConnections.set(user.userId, user.sessionCount);
    }

    if (!this.initializedConnections) {
      this.knownConnections = nextConnections;
      this.initializedConnections = true;
      return;
    }

    for (const user of users.users) {
      const previousSessions = this.knownConnections.get(user.userId) ?? 0;

      if (user.sessionCount > previousSessions) {
        this.pushSystemConnectionMessage(user.username);
      }
    }

    this.knownConnections = nextConnections;
  }

  private pushSystemConnectionMessage(username: string): void {
    const now = new Date().toISOString();
    const systemMessage: ChatMessageResponse = {
      senderUserId: 0,
      senderUsername: 'Sistema',
      recipientUserId: null,
      recipientUsername: null,
      content: `${username} se conecto al chat.`,
      sentAt: `${now}-${Math.random().toString(16).slice(2, 8)}`,
      type: 'MESSAGE',
    };

    this.messagesState.update((messages) => [...messages, systemMessage].slice(-200));
  }

  selectAll(): void {
    this.selectedRecipientState.set(null);
  }

  isSelf(user: ConnectedChatUserResponse): boolean {
    return user.userId === this.currentUserId();
  }

  selectUser(user: ConnectedChatUserResponse): void {
    // No permitir chat privado consigo mismo; el usuario sigue visible en la lista.
    if (this.isSelf(user)) {
      return;
    }

    this.selectedRecipientState.set(user);
  }

  send(content: string): void {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return;
    }

    this.realtime.sendChatMessage(trimmedContent, this.selectedRecipientState()?.userId ?? null);
  }

  setChatOpen(isOpen: boolean): void {
    this.isOpenState.set(isOpen);
  }

  getInitials(username: string): string {
    return getUserInitials(username);
  }
}
