import { Injectable } from '@angular/core';
import { PDFDocument, PDFTextField, StandardFonts } from 'pdf-lib';
import {
  TransportRequestItemResponse,
  TransportRequestResponse,
} from '../../models/transport-request.model';

const TEMPLATE_URL = '/forms/CO-31_S.pdf';
const MAX_VISIBLE_ITEMS = 5;

const ITEM_FIELDS = [
  { quantity: 'Text13', description: 'Text14', sizeAndWeight: 'Text15', lineTotal: 'Text16' },
  { quantity: 'Text17', description: 'Text18', sizeAndWeight: 'Text19', lineTotal: 'Text20' },
  { quantity: 'Text21', description: 'Text22', sizeAndWeight: 'Text23', lineTotal: 'Text24' },
  { quantity: 'Text25', description: 'Text26', sizeAndWeight: 'Text27', lineTotal: 'Text28' },
  { quantity: 'Text29', description: 'Text30', sizeAndWeight: 'Text31', lineTotal: 'Text32' },
];

@Injectable({ providedIn: 'root' })
export class TransportRequestPdfService {
  async createRequestPdfUrl(
    request: TransportRequestResponse,
    eventDescription: string | null = null,
  ): Promise<string> {
    const pdfBytes = await this.createPdf(request, eventDescription);
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

  private async createPdf(
    request: TransportRequestResponse,
    eventDescription: string | null,
  ): Promise<Uint8Array> {
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
      field.setFontSize(8);
    };

    setText('Text1', request.requestNumber);
    setText('Text2', this.formatDate(request.requestDate));
    setText('Text3', request.requestedFrom);
    setText('Text4', request.requestedTo);
    setText('Text5', eventDescription);
    setText('Text6', request.targetDepartment);
    setText('Text7', request.targetPlace);
    setText('Text9', this.formatDate(request.desiredDate));
    setText('Text10', this.formatTime(request.desiredTime));
    setText('Text12', this.formatMoney(request.estimatedAmount));

    for (const [index, fields] of ITEM_FIELDS.entries()) {
      const item = request.items[index];
      this.fillItemRow(setText, fields, item);
    }

    setText('Text33', this.buildObservations(request));
    setText('Text34', request.receivedBy);
    setText('Text35', request.authorizedBy);
    setText('Text36', this.formatDate(request.receivedDate));
    setText('Text37', this.formatTime(request.receivedTime, true));

    form.updateFieldAppearances(font);

    return pdf.save();
  }

  private async loadTemplate(): Promise<ArrayBuffer> {
    const response = await fetch(TEMPLATE_URL);

    if (!response.ok) {
      throw new Error('No se pudo cargar la plantilla CO-31.');
    }

    return response.arrayBuffer();
  }

  private fillItemRow(
    setText: (fieldName: string, value: string | number | null | undefined) => void,
    fields: (typeof ITEM_FIELDS)[number],
    item: TransportRequestItemResponse | undefined,
  ): void {
    setText(fields.quantity, item ? this.formatQuantity(item.quantity) : null);
    setText(fields.description, item?.description);
    setText(fields.sizeAndWeight, item?.sizeAndWeight);
    setText(fields.lineTotal, item ? this.formatMoney(item.lineTotal) : null);
  }

  private buildObservations(request: TransportRequestResponse): string {
    const observations = request.observations?.trim();
    const extraItems = request.items.length - MAX_VISIBLE_ITEMS;

    if (extraItems > 0) {
      const suffix = `Hay ${extraItems} item${extraItems === 1 ? '' : 's'} adicional${
        extraItems === 1 ? '' : 'es'
      } registrado${extraItems === 1 ? '' : 's'} en la solicitud.`;

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

  private formatTime(value: string | null, includePeriod = false): string {
    if (!value) {
      return '';
    }

    const [hoursRaw, minutes = '00'] = value.split(':');
    const hours = Number(hoursRaw);

    if (!includePeriod || !Number.isFinite(hours)) {
      return `${hoursRaw}:${minutes}`;
    }

    const period = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;

    return `${String(displayHours).padStart(2, '0')}:${minutes} ${period}`;
  }

  private formatMoney(value: number | null): string {
    if (value === null) {
      return '';
    }

    return new Intl.NumberFormat('es-CO', {
      maximumFractionDigits: 2,
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
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
