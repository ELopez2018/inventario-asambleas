import { Injectable } from '@angular/core';
import { PDFDocument, PDFTextField, StandardFonts } from 'pdf-lib';
import {
  TransportDeliveryReceiptItemResponse,
  TransportDeliveryReceiptResponse,
} from '../../models/transport-delivery-receipt.model';

const TEMPLATE_URL = '/forms/CO-30_S.pdf';
const MAX_VISIBLE_ITEMS = 5;

const ITEM_FIELDS = [
  { articleNumber: 'Text6', description: 'Text7', requestNumber: 'Text8', quantity: 'Text9' },
  { articleNumber: 'Text10', description: 'Text11', requestNumber: 'Text12', quantity: 'Text13' },
  { articleNumber: 'Text14', description: 'Text15', requestNumber: 'Text16', quantity: 'Text17' },
  { articleNumber: 'Text18', description: 'Text19', requestNumber: 'Text20', quantity: 'Text21' },
  { articleNumber: 'Text22', description: 'Text23', requestNumber: 'Text24', quantity: 'Text25' },
];

@Injectable({ providedIn: 'root' })
export class TransportDeliveryReceiptPdfService {
  async createReceiptPdfUrl(receipt: TransportDeliveryReceiptResponse): Promise<string> {
    const pdfBytes = await this.createPdf(receipt);
    const pdfBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });

    return URL.createObjectURL(blob);
  }

  revokePdfUrl(url: string): void {
    URL.revokeObjectURL(url);
  }

  private async createPdf(receipt: TransportDeliveryReceiptResponse): Promise<Uint8Array> {
    const templateBytes = await this.loadTemplate();
    const pdf = await PDFDocument.load(templateBytes);
    const form = pdf.getForm();
    const font = await pdf.embedFont(StandardFonts.Helvetica);

    const setText = (fieldName: string, value: string | number | null | undefined): void => {
      const field = form.getFieldMaybe(fieldName);

      if (!(field instanceof PDFTextField)) {
        return;
      }

      field.setText(this.toDisplayText(value));
    };

    setText('Text1', this.formatDate(receipt.receiptDate));
    setText('Text2', receipt.receiptNumber);
    setText('Text3', receipt.ownerName);
    setText('Text4', receipt.ownerPhone);
    setText('Text5', receipt.ownerAddress);

    for (const [index, fields] of ITEM_FIELDS.entries()) {
      const item = receipt.items[index];
      this.fillItemRow(setText, fields, item, receipt.transportRequestNumber);
    }

    setText('Text26', this.buildObservations(receipt));
    setText('Text27', receipt.receivedBy);
    setText('Text28', receipt.returnDeliveredTo);
    setText('Text29', receipt.returnReceivedBy);
    setText('Text30', this.formatDate(receipt.returnDate));
    setText('Text31', receipt.returnReceivedBy);

    form.updateFieldAppearances(font);

    return pdf.save();
  }

  private async loadTemplate(): Promise<ArrayBuffer> {
    const response = await fetch(TEMPLATE_URL);

    if (!response.ok) {
      throw new Error('No se pudo cargar la plantilla CO-30.');
    }

    return response.arrayBuffer();
  }

  private fillItemRow(
    setText: (fieldName: string, value: string | number | null | undefined) => void,
    fields: (typeof ITEM_FIELDS)[number],
    item: TransportDeliveryReceiptItemResponse | undefined,
    transportRequestNumber: string,
  ): void {
    setText(fields.articleNumber, item?.articleNumber);
    setText(fields.description, item?.description);
    setText(fields.requestNumber, item?.requestNumber ?? transportRequestNumber);
    setText(fields.quantity, item ? this.formatQuantity(item.quantity) : null);
  }

  private buildObservations(receipt: TransportDeliveryReceiptResponse): string {
    const observations = receipt.observations?.trim();
    const extraItems = receipt.items.length - MAX_VISIBLE_ITEMS;

    if (extraItems > 0) {
      const suffix = `Hay ${extraItems} articulo${extraItems === 1 ? '' : 's'} adicional${
        extraItems === 1 ? '' : 'es'
      } registrado${extraItems === 1 ? '' : 's'} en el recibo.`;

      return observations ? `${observations} ${suffix}` : suffix;
    }

    return observations ?? '';
  }

  private formatDate(value: string | null): string {
    if (!value) {
      return '';
    }

    const [year, month, day] = value.slice(0, 10).split('-');

    if (!year || !month || !day) {
      return value;
    }

    return `${day}/${month}/${year}`;
  }

  private formatQuantity(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      maximumFractionDigits: 2,
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  }

  private toDisplayText(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
  }
}
