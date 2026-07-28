import { Injectable, inject } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { BehaviorSubject, Subject } from 'rxjs';
import SockJS from 'sockjs-client';
import {
  ChatMessageRequest,
  ChatMessageResponse,
  ConnectedChatUsersResponse,
} from '../../models/chat.model';
import { API_BASE_URL } from '../api.config';
import { AuthService } from './auth.service';

const WS_URL = API_BASE_URL.replace('/inventory/api/v1', '/inventory/api/v1/ws');
const TRACE_HEADER = 'X-Trace-Id';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private client: Client | null = null;
  private authFailureHandled = false;

  private readonly chatMessagesSubject = new Subject<ChatMessageResponse>();
  private readonly connectedUsersSubject = new BehaviorSubject<ConnectedChatUsersResponse | null>(
    null,
  );

  readonly chatMessages$ = this.chatMessagesSubject.asObservable();
  readonly connectedUsers$ = this.connectedUsersSubject.asObservable();

  connect(): void {
    const token = this.auth.getToken();

    if (!token || this.client?.active) {
      return;
    }

    this.authFailureHandled = false;

    try {
      this.client = new Client({
        webSocketFactory: () => {
          try {
            return new SockJS(`${WS_URL}?access_token=${encodeURIComponent(token)}`);
          } catch (error) {
            console.warn('[realtime] no se pudo crear el socket', error);
            throw error;
          }
        },
        connectHeaders: this.traceHeaders(),
        reconnectDelay: 5000,
        onConnect: () => {
          this.safeSubscribe('/topic/chat/messages', (message) =>
            this.emitJson(message, this.chatMessagesSubject),
          );
          this.safeSubscribe('/user/queue/chat/messages', (message) =>
            this.emitJson(message, this.chatMessagesSubject),
          );
          this.safeSubscribe('/topic/chat/users', (message) => {
            const parsed = this.tryParse<ConnectedChatUsersResponse>(message.body);
            if (parsed) {
              this.connectedUsersSubject.next(parsed);
            }
          });
          this.safeSubscribe('/app/chat.users', (message) => {
            const parsed = this.tryParse<ConnectedChatUsersResponse>(message.body);
            if (parsed) {
              this.connectedUsersSubject.next(parsed);
            }
          });
        },
        onStompError: (frame) => {
          const message = `${frame.headers?.['message'] ?? ''} ${frame.body ?? ''}`.toLowerCase();
          console.warn('[realtime] STOMP error', frame.headers?.['message'] ?? frame.body);
          this.handleAuthFailureIfNeeded(message);
        },
        onWebSocketError: (event) => {
          console.warn('[realtime] websocket error', event);
        },
        onWebSocketClose: (event) => {
          const reason = `${event.code} ${event.reason ?? ''}`.toLowerCase();
          this.handleAuthFailureIfNeeded(reason);
        },
      });

      this.client.activate();
    } catch (error) {
      console.warn('[realtime] no se pudo iniciar el cliente STOMP', error);
      this.client = null;
    }
  }

  disconnect(): void {
    try {
      void this.client?.deactivate();
    } catch (error) {
      console.warn('[realtime] fallo al cerrar el cliente STOMP', error);
    }
    this.client = null;
    this.connectedUsersSubject.next(null);
  }

  sendChatMessage(content: string, recipientUserId: number | null = null): void {
    if (!this.client?.connected) {
      return;
    }

    const body: ChatMessageRequest = { content, recipientUserId };

    try {
      this.client.publish({
        destination: '/app/chat.send',
        headers: this.traceHeaders(),
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.warn('[realtime] no se pudo enviar el mensaje de chat', error);
    }
  }

  private emitJson<T>(message: IMessage, subject: Subject<T>): void {
    const parsed = this.tryParse<T>(message.body);
    if (parsed) {
      subject.next(parsed);
    }
  }

  private safeSubscribe(destination: string, handler: (message: IMessage) => void): void {
    try {
      this.client?.subscribe(destination, handler, this.traceHeaders());
    } catch (error) {
      console.warn(`[realtime] no se pudo suscribir a ${destination}`, error);
    }
  }

  private tryParse<T>(body: string): T | null {
    if (!body) {
      return null;
    }

    try {
      return JSON.parse(body) as T;
    } catch (error) {
      console.warn('[realtime] payload STOMP invalido', error);
      return null;
    }
  }

  private traceHeaders(): Record<string, string> {
    return { [TRACE_HEADER]: this.nextTraceId() };
  }

  private nextTraceId(): string {
    return (
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
  }

  private handleAuthFailureIfNeeded(message: string): void {
    if (this.authFailureHandled) {
      return;
    }

    const looksLikeAuthFailure =
      message.includes('401') ||
      message.includes('403') ||
      message.includes('unauthor') ||
      message.includes('forbidden') ||
      message.includes('token') ||
      message.includes('jwt');

    if (!looksLikeAuthFailure) {
      return;
    }

    this.authFailureHandled = true;
    this.auth.expireSession();
  }
}
