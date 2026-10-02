import { Injectable } from '@angular/core';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { StoreResponse } from '../../models/store.model';
import { StoreOrdersReport } from '../../models/store-orders-report.model';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_LIMIT = 48;
const TABLE_COLUMNS = [
  { title: 'Número', width: 42, align: 'center' },
  { title: 'Descripción', width: 180, align: 'left' },
  { title: 'Cantidad', width: 62, align: 'right' },
  { title: 'Formulario C-30', width: 105, align: 'left' },
  { title: 'Responsable', width: CONTENT_WIDTH - 389, align: 'left' },
] as const;
const COLORS = {
  ink: rgb(0.12, 0.16, 0.19),
  muted: rgb(0.34, 0.39, 0.41),
  rule: rgb(0.73, 0.78, 0.78),
  header: rgb(0.07, 0.32, 0.31),
  headerText: rgb(1, 1, 1),
  alternateRow: rgb(0.95, 0.97, 0.96),
};

@Injectable({ providedIn: 'root' })
export class StoreOrdersReportPdfService {
  async createPdfUrl(report: StoreOrdersReport, store: StoreResponse): Promise<string> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
    const generatedAt = new Date();
    const pages: PDFPage[] = [];
    let page = this.addPage(pdf, report, store, font, boldFont, generatedAt);
    pages.push(page.page);

    report.orders.forEach((order, index) => {
      const values = [
        String(index + 1),
        order.description || '-',
        this.formatQuantity(order.quantity),
        order.co30FormNumber || '-',
        order.responsible || '-',
      ];
      const lines = values.map((value, columnIndex) =>
        this.wrapText(font, value, TABLE_COLUMNS[columnIndex].width - 12, 8.5),
      );
      const rowHeight = Math.max(...lines.map((cellLines) => cellLines.length)) * 11 + 10;

      if (page.cursor - rowHeight < FOOTER_LIMIT) {
        page = this.addPage(pdf, report, store, font, boldFont, generatedAt);
        pages.push(page.page);
      }

      this.drawRow(page.page, page.cursor, rowHeight, lines, font, index % 2 === 1);
      page.cursor -= rowHeight;
    });

    pages.forEach((currentPage, index) =>
      this.drawFooter(currentPage, index + 1, pages.length, font),
    );

    const bytes = await pdf.save();
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    return URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
  }

  revokePdfUrl(url: string): void {
    URL.revokeObjectURL(url);
  }

  private addPage(
    pdf: PDFDocument,
    report: StoreOrdersReport,
    store: StoreResponse,
    font: PDFFont,
    boldFont: PDFFont,
    generatedAt: Date,
  ): { page: PDFPage; cursor: number } {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let cursor = PAGE_HEIGHT - MARGIN;

    page.drawText('Reporte de pedidos por almacén', {
      x: MARGIN,
      y: cursor,
      size: 15,
      font: boldFont,
      color: COLORS.ink,
    });
    cursor -= 23;

    const storeNameLines = this.wrapText(
      boldFont,
      `Almacén: ${report.storeName || store.description}`,
      CONTENT_WIDTH,
      11,
    );
    storeNameLines.forEach((line, index) => {
      page.drawText(line, {
        x: MARGIN,
        y: cursor - index * 14,
        size: 11,
        font: boldFont,
        color: COLORS.ink,
      });
    });
    cursor -= storeNameLines.length * 14 + 2;

    page.drawText(`Fecha de emisión: ${generatedAt.toLocaleString('es-CO')}`, {
      x: MARGIN,
      y: cursor,
      size: 8.5,
      font,
      color: COLORS.muted,
    });
    cursor -= 18;

    const details = [
      ['Código', String(store.id)],
      ['Estado', store.available ? 'Disponible' : 'No disponible'],
      ['Dirección', store.address?.trim() || 'No registrada'],
      ['Teléfono', store.phone?.trim() || 'No registrado'],
      ['Coordenadas GPS', store.gpsCoordinates?.trim() || 'No registradas'],
    ];
    const columnGap = 18;
    const detailWidth = (CONTENT_WIDTH - columnGap) / 2;

    for (let index = 0; index < details.length; index += 2) {
      const pairs = [details[index], details[index + 1]].filter(
        (pair): pair is [string, string] => pair !== undefined,
      );
      const pairLines = pairs.map(([label, value]) =>
        this.wrapText(font, `${label}: ${value}`, detailWidth, 8),
      );
      const lineCount = Math.max(...pairLines.map((lines) => lines.length));

      pairLines.forEach((lines, pairIndex) => {
        const x = MARGIN + pairIndex * (detailWidth + columnGap);
        lines.forEach((line, lineIndex) => {
          page.drawText(line, {
            x,
            y: cursor - lineIndex * 10,
            size: 8,
            font,
            color: COLORS.ink,
          });
        });
      });
      cursor -= lineCount * 10 + 4;
    }

    page.drawText(`Total general: ${this.formatQuantity(report.totalQuantity)}`, {
      x: MARGIN,
      y: cursor,
      size: 9,
      font: boldFont,
      color: COLORS.ink,
    });
    cursor -= 19;

    this.drawTableHeader(page, cursor, boldFont);
    cursor -= 23;

    return { page, cursor };
  }

  private drawTableHeader(page: PDFPage, top: number, font: PDFFont): void {
    page.drawRectangle({
      x: MARGIN,
      y: top - 21,
      width: CONTENT_WIDTH,
      height: 21,
      color: COLORS.header,
    });

    let x = MARGIN;
    TABLE_COLUMNS.forEach((column) => {
      const textWidth = font.widthOfTextAtSize(column.title, 8);
      const textX = column.align === 'center' ? x + (column.width - textWidth) / 2 : x + 6;
      page.drawText(column.title, {
        x: textX,
        y: top - 14,
        size: 8,
        font,
        color: COLORS.headerText,
      });
      x += column.width;
    });
  }

  private drawRow(
    page: PDFPage,
    top: number,
    height: number,
    lines: string[][],
    font: PDFFont,
    alternate: boolean,
  ): void {
    const bottom = top - height;
    page.drawRectangle({
      x: MARGIN,
      y: bottom,
      width: CONTENT_WIDTH,
      height,
      color: alternate ? COLORS.alternateRow : rgb(1, 1, 1),
      borderColor: COLORS.rule,
      borderWidth: 0.4,
    });

    let x = MARGIN;
    TABLE_COLUMNS.forEach((column, columnIndex) => {
      const cellLines = lines[columnIndex];
      cellLines.forEach((line, lineIndex) => {
        const lineWidth = font.widthOfTextAtSize(line, 8.5);
        let textX = x + 6;

        if (column.align === 'center') {
          textX = x + Math.max((column.width - lineWidth) / 2, 3);
        } else if (column.align === 'right') {
          textX = x + column.width - lineWidth - 6;
        }

        page.drawText(line, {
          x: textX,
          y: top - 13 - lineIndex * 11,
          size: 8.5,
          font,
          color: COLORS.ink,
        });
      });
      x += column.width;
    });
  }

  private drawFooter(page: PDFPage, pageNumber: number, totalPages: number, font: PDFFont): void {
    const label = `Página ${pageNumber} de ${totalPages}`;
    const labelWidth = font.widthOfTextAtSize(label, 8);
    const y = 28;

    page.drawLine({
      start: { x: MARGIN, y: y + 12 },
      end: { x: PAGE_WIDTH - MARGIN, y: y + 12 },
      thickness: 0.5,
      color: COLORS.rule,
    });
    page.drawText(label, {
      x: (PAGE_WIDTH - labelWidth) / 2,
      y,
      size: 8,
      font,
      color: COLORS.muted,
    });
  }

  private wrapText(font: PDFFont, value: string, maxWidth: number, size: number): string[] {
    const lines: string[] = [];
    let currentLine = '';

    for (const word of value.trim().split(/\s+/)) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;

      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        currentLine = candidate;
        continue;
      }

      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }

      for (const character of Array.from(word)) {
        const characterCandidate = currentLine + character;

        if (currentLine && font.widthOfTextAtSize(characterCandidate, size) > maxWidth) {
          lines.push(currentLine);
          currentLine = character;
        } else {
          currentLine = characterCandidate;
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length ? lines : [''];
  }

  private formatQuantity(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      maximumFractionDigits: 2,
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  }
}
