import { CommonModule } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface RequestPdfDialogData {
  pdfUrl: string;
  requestNumber: string;
}

@Component({
  selector: 'app-request-pdf-dialog',
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './request-pdf-dialog.component.html',
  styleUrl: './request-pdf-dialog.component.css',
})
export class RequestPdfDialogComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly dialogRef = inject(MatDialogRef<RequestPdfDialogComponent>);

  readonly safePdfUrl: SafeResourceUrl;

  constructor(@Inject(MAT_DIALOG_DATA) readonly data: RequestPdfDialogData) {
    this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(data.pdfUrl);
  }

  openInNewTab(): void {
    window.open(this.data.pdfUrl, '_blank', 'noopener,noreferrer');
  }

  close(): void {
    this.dialogRef.close();
  }
}
