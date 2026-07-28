import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  imports: [CommonModule, FormsModule, MatBadgeModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './internal-chat-floating-panel.component.html',
  styleUrl: './internal-chat-floating-panel.component.css',
})
export class InternalChatFloatingPanelComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  readonly chat = inject(InternalChatService);
  readonly open = signal(false);
  readonly draft = signal('');
  readonly unread = signal(0);
  readonly users = computed(() => this.chat.availableUsers());
  readonly title = computed(() => this.chat.selectedTitle());
  readonly currentUserId = computed(() => this.auth.getCurrentUser()?.userId ?? null);

  constructor() {
    this.chat.messages$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.open()) {
        this.unread.update((count) => count + 1);
      }
    });
  }

  toggle(): void {
    this.open.update((value) => !value);

    if (this.open()) {
      this.unread.set(0);
    }
  }

  selectAll(): void {
    this.chat.selectAll();
  }

  selectUser(user: ConnectedChatUserResponse): void {
    this.chat.selectUser(user);
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
}
