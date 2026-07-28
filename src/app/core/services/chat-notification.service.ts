import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ChatMessageResponse } from '../../models/chat.model';
import { getUserInitials } from '../../shared/user-initials.util';

@Injectable({ providedIn: 'root' })
export class ChatNotificationService {
  private readonly snackBar = inject(MatSnackBar);

  showMessageNotification(message: ChatMessageResponse): void {
    const initials = getUserInitials(message.senderUsername);
    const typeLabel = message.type === 'PRIVATE' ? '(Privado)' : '(Público)';
    const displayText = `${initials} ${typeLabel}: ${message.content}`;

    this.snackBar.open(displayText, 'Cerrar', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['chat-notification-toast'],
    });
  }
}
