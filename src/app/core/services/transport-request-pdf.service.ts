import { Injectable } from '@angular/core';
import { PDFDocument, PDFTextField, StandardFonts } from 'pdf-lib';
import {
  TransportRequestItemResponse,
  TransportRequestResponse,
} from '../../models/transport-request.model';

const TEMPLATE_URL = '/forms/CO-31_S.pdf';
const MAX_VISIBLE_ITEMS = 5;
const CONTINUATION_ROWS_PER_PAGE = 18;
const CONTINUATION_TABLE = {
  left: 46,
  right: 548,
  top: 380,
  bottom: 38,
  rowHeight: 19,
  columns: [103, 356, 469, 548],
};

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

    this.addContinuationPages(pdf, font, request);

    return pdf.save();
  }

  private addContinuationPages(
    pdf: PDFDocument,
    font: Awaited<ReturnType<PDFDocument['embedFont']>>,
    request: TransportRequestResponse,
  ): void {
    const additionalItems = request.items.slice(MAX_VISIBLE_ITEMS);

    for (let start = 0; start < additionalItems.length; start += CONTINUATION_ROWS_PER_PAGE) {
      const page = pdf.addPage([595.2, 420.9]);
      const pageItems = additionalItems.slice(start, start + CONTINUATION_ROWS_PER_PAGE);
      const dateLabel = `Fecha: ${this.formatDate(request.requestDate)}`;
      const numberLabel = `Numero: ${request.requestNumber}`;
      const fontSize = 9;

      page.drawText(numberLabel, { x: CONTINUATION_TABLE.left, y: 397, size: fontSize, font });
      page.drawText(dateLabel, {
        x: CONTINUATION_TABLE.right - font.widthOfTextAtSize(dateLabel, fontSize),
        y: 397,
        size: fontSize,
        font,
      });

      page.drawLine({
        start: { x: CONTINUATION_TABLE.left, y: CONTINUATION_TABLE.top },
        end: { x: CONTINUATION_TABLE.right, y: CONTINUATION_TABLE.top },
        thickness: 0.7,
      });

      for (let row = 0; row <= CONTINUATION_ROWS_PER_PAGE; row++) {
        const y = CONTINUATION_TABLE.top - row * CONTINUATION_TABLE.rowHeight;
        page.drawLine({
          start: { x: CONTINUATION_TABLE.left, y },
          end: { x: CONTINUATION_TABLE.right, y },
          thickness: 0.35,
          opacity: 0.7,
        });
      }

      for (const x of [CONTINUATION_TABLE.left, ...CONTINUATION_TABLE.columns]) {
        page.drawLine({
          start: { x, y: CONTINUATION_TABLE.top },
          end: { x, y: CONTINUATION_TABLE.bottom },
          thickness: 0.35,
          opacity: 0.7,
        });
      }

      pageItems.forEach((item, row) => {
        const y = CONTINUATION_TABLE.top - (row + 1) * CONTINUATION_TABLE.rowHeight + 5;
        const values = [
          this.formatQuantity(item.quantity),
          item.description,
          item.sizeAndWeight ?? '',
          this.formatMoney(item.lineTotal),
        ];
        const starts = [CONTINUATION_TABLE.left, ...CONTINUATION_TABLE.columns.slice(0, -1)];
        const ends = CONTINUATION_TABLE.columns;

        values.forEach((value, index) => {
          page.drawText(this.truncateText(font, value, ends[index] - starts[index] - 6, 8), {
            x: starts[index] + 3,
            y,
            size: 8,
            font,
          });
        });
      });
    }
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
    return request.observations?.trim() ?? '';
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

  private truncateText(
    font: Awaited<ReturnType<PDFDocument['embedFont']>>,
    value: string,
    maxWidth: number,
    size: number,
  ): string {
    if (font.widthOfTextAtSize(value, size) <= maxWidth) {
      return value;
    }

    const suffix = '...';
    let result = value;

    while (result && font.widthOfTextAtSize(`${result}${suffix}`, size) > maxWidth) {
      result = result.slice(0, -1);
    }

    return `${result}${suffix}`;
  }
}
