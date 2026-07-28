import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/services/auth.service';
import { InternalChatService } from '../../../core/services/internal-chat.service';
import { ChatMessageResponse, ConnectedChatUserResponse } from '../../../models/chat.model';

@Component({
  selector: 'app-internal-chat-floating-panel',
  imports: [
    CommonModule,
    FormsModule,
    MatBadgeModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './internal-chat-floating-panel.component.html',
  styleUrl: './internal-chat-floating-panel.component.css',
})
export class InternalChatFloatingPanelComponent {
  private readonly auth = inject(AuthService);

  readonly chat = inject(InternalChatService);
  readonly open = signal(false);
  readonly draft = signal('');
  readonly users = computed(() => this.chat.connectedUsers());
  readonly totalUsers = computed(() => this.chat.totalConnectedUsers());
  readonly title = computed(() => this.chat.selectedTitle());
  readonly currentUserId = computed(() => this.auth.getCurrentUser()?.userId ?? null);

  toggle(): void {
    this.open.update((value) => !value);
    this.chat.setChatOpen(this.open());
  }

  selectAll(): void {
    this.chat.selectAll();
  }

  selectUser(user: ConnectedChatUserResponse): void {
    this.chat.selectUser(user);
  }

  isSelf(user: ConnectedChatUserResponse): boolean {
    return this.chat.isSelf(user);
  }

  send(): void {
    this.chat.send(this.draft());
    this.draft.set('');
  }

  isSelectedUser(user: ConnectedChatUserResponse): boolean {
    return this.chat.selectedRecipient()?.userId === user.userId;
  }

  isVisible(message: ChatMessageResponse): boolean {
    const selected = this.chat.selectedRecipient();

    if (!selected) {
      return message.type === 'MESSAGE';
    }

    return (
      message.type === 'PRIVATE' &&
      (message.senderUserId === selected.userId || message.recipientUserId === selected.userId)
    );
  }

  isMine(message: ChatMessageResponse): boolean {
    return message.senderUserId === this.currentUserId();
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    this.send();
  }

  getInitials(username: string): string {
    return this.chat.getInitials(username);
  }
}
