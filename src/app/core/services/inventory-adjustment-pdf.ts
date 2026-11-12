import { PDFDocument, PDFFont } from 'pdf-lib';

interface AdjustmentPdfItem {
  description: string;
  quantity: number;
  allocatedQuantity?: number;
  inventoryAdjustmentNote?: string | null;
  inventoryAdjustmentReason?: string | null;
}

/** The original form stays editable; the appendix preserves full adjustment reasons. */
export function addInventoryAdjustmentPages(
  pdf: PDFDocument,
  font: PDFFont,
  items: AdjustmentPdfItem[],
  documentLabel: string,
): void {
  const adjusted = items.filter((item) => item.inventoryAdjustmentNote || item.inventoryAdjustmentReason);
  if (!adjusted.length) return;
  let page = pdf.addPage([612, 396]);
  let y = 350;
  const heading = () => page.drawText(`${documentLabel} - Ajustes de inventario`, { x: 28, y: 372, size: 12, font });
  heading();
  const safeText = (text: string) => [...text].map((character) => {
    if (character === '\n') return character;
    try { font.encodeText(character); return character; } catch { return '?'; }
  }).join('');
  const drawLine = (text: string) => {
    if (y < 40) { page = pdf.addPage([612, 396]); y = 350; heading(); }
    page.drawText(text, { x: 28, y, size: 9, font });
    y -= 13;
  };
  const paragraph = (text: string) => {
    for (const segment of safeText(text).split('\n')) {
      let line = '';
      for (const word of segment.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, 9) <= 550) { line = candidate; continue; }
        if (line) drawLine(line);
        line = '';
        for (const character of word) {
          if (font.widthOfTextAtSize(line + character, 9) > 550) { drawLine(line); line = ''; }
          line += character;
        }
      }
      drawLine(line);
    }
  };
  for (const item of adjusted) {
    paragraph(`${item.description} ${item.inventoryAdjustmentNote ?? ''}`.trim());
    paragraph(`Solicitado: ${item.quantity} | Asignado: ${item.allocatedQuantity ?? item.quantity}`);
    paragraph(`Razon del ultimo ajuste: ${item.inventoryAdjustmentReason ?? 'Faltante previo sin ajuste registrado.'}`);
    y -= 10;
  }
}
