import { Injectable } from '@angular/core';
import { PDFDocument, PDFTextField, StandardFonts, rgb } from 'pdf-lib';
import {
  TransportDeliveryReceiptItemResponse,
  TransportDeliveryReceiptResponse,
} from '../../models/transport-delivery-receipt.model';

const TEMPLATE_URL = '/forms/CO-30_S.pdf';
const MAX_VISIBLE_ITEMS = 5;
const CONTINUATION_ROWS_PER_PAGE = 16;
const CONTINUATION_TABLE = {
  top: 318,
  bottom: 30,
  rowHeight: 18,
  cells: [
    { x: 22, width: 40 },
    { x: 88, width: 280 },
    { x: 380, width: 145 },
    { x: 552, width: 38 },
  ],
};

const ITEM_FIELDS = [
  { articleNumber: 'Text6', description: 'Text7', assignedTo: 'Text8', requestNumber: 'Text9' },
  { articleNumber: 'Text10', description: 'Text11', assignedTo: 'Text12', requestNumber: 'Text13' },
  { articleNumber: 'Text14', description: 'Text15', assignedTo: 'Text16', requestNumber: 'Text17' },
  { articleNumber: 'Text18', description: 'Text19', assignedTo: 'Text20', requestNumber: 'Text21' },
  { articleNumber: 'Text22', description: 'Text23', assignedTo: 'Text24', requestNumber: 'Text25' },
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
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

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
      this.fillItemRow(setText, fields, item);
    }

    setText('Text26', this.buildObservations(receipt));
    setText('Text27', receipt.receivedBy);
    setText('Text28', receipt.returnDeliveredTo);
    setText('Text29', receipt.returnReceivedBy);
    setText('Text30', this.formatDate(receipt.returnDate));
    setText('Text31', receipt.returnReceivedBy);

    form.updateFieldAppearances(font);

    this.addContinuationPages(pdf, font, boldFont, receipt);

    return pdf.save();
  }

  private addContinuationPages(
    pdf: PDFDocument,
    font: Awaited<ReturnType<PDFDocument['embedFont']>>,
    boldFont: Awaited<ReturnType<PDFDocument['embedFont']>>,
    receipt: TransportDeliveryReceiptResponse,
  ): void {
    const additionalItems = receipt.items.slice(MAX_VISIBLE_ITEMS);

    for (let start = 0; start < additionalItems.length; start += CONTINUATION_ROWS_PER_PAGE) {
      const page = pdf.addPage([612, 396]);
      const pageItems = additionalItems.slice(start, start + CONTINUATION_ROWS_PER_PAGE);
      const numberLabel = `Numero: ${receipt.receiptNumber}`;
      const dateLabel = `Fecha: ${this.formatDate(receipt.receiptDate)}`;
      const fontSize = 9;

      page.drawText(numberLabel, { x: 22, y: 374, size: fontSize, font });
      page.drawText(dateLabel, {
        x: 590 - font.widthOfTextAtSize(dateLabel, fontSize),
        y: 374,
        size: fontSize,
        font,
      });

      this.drawCenteredText(page, font, 'Num. de', CONTINUATION_TABLE.cells[0], 346, 8);
      this.drawCenteredText(page, font, 'articulo', CONTINUATION_TABLE.cells[0], 336, 8);
      this.drawCenteredText(page, boldFont, 'Articulos y descripcion', CONTINUATION_TABLE.cells[1], 350, 10);
      this.drawCenteredText(page, font, 'Descripcion', CONTINUATION_TABLE.cells[1], 334, 8);
      this.drawCenteredText(page, font, 'Asignado a', CONTINUATION_TABLE.cells[2], 334, 8);
      this.drawCenteredText(page, font, 'Num. de', CONTINUATION_TABLE.cells[3], 346, 8);
      this.drawCenteredText(page, font, 'pedido', CONTINUATION_TABLE.cells[3], 336, 8);

      pageItems.forEach((item, row) => {
        const y = CONTINUATION_TABLE.top - (row + 1) * CONTINUATION_TABLE.rowHeight;
        const values = [
          item.articleNumber,
          `(${item.quantity}) ${item.description}`,
          item.assignedTo ?? '',
          item.requestNumber,
        ];
        values.forEach((value, index) => {
          const cell = CONTINUATION_TABLE.cells[index];
          page.drawRectangle({
            x: cell.x,
            y,
            width: cell.width,
            height: CONTINUATION_TABLE.rowHeight - 2,
            color: rgb(0.94, 0.95, 0.99),
          });
          page.drawLine({
            start: { x: cell.x, y: y + 1 },
            end: { x: cell.x + cell.width, y: y + 1 },
            thickness: 0.45,
            color: rgb(0.25, 0.25, 0.3),
          });
          this.drawCenteredText(
            page,
            font,
            this.truncateText(font, value, cell.width - 6, 8),
            cell,
            y + 5,
            8,
          );
        });
      });
    }
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
  ): void {
    setText(fields.articleNumber, item?.articleNumber);
    const description = item != null ? `(${item.quantity}) ${item.description}` : undefined;
    setText(fields.description, description);
    setText(fields.assignedTo, item?.assignedTo);
    setText(fields.requestNumber, item?.requestNumber);
  }

  private buildObservations(receipt: TransportDeliveryReceiptResponse): string {
    return receipt.observations?.trim() ?? '';
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

  private drawCenteredText(
    page: ReturnType<PDFDocument['addPage']>,
    font: Awaited<ReturnType<PDFDocument['embedFont']>>,
    value: string,
    cell: { x: number; width: number },
    y: number,
    size: number,
  ): void {
    page.drawText(value, {
      x: cell.x + Math.max((cell.width - font.widthOfTextAtSize(value, size)) / 2, 0),
      y,
      size,
      font,
    });
  }
}
