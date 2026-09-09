import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import type {
  SignatureInput,
  WorkRequestFormData,
} from '@/src/domain/work-requests/work-request';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const NAVY = rgb(31 / 255, 56 / 255, 100 / 255);
const LIGHT_BLUE = rgb(232 / 255, 238 / 255, 247 / 255);
const GRAY = rgb(92 / 255, 104 / 255, 122 / 255);

function pdfBytesToBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: 'application/pdf' });
}

interface DrawingContext {
  document: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  boldFont: PDFFont;
  y: number;
  pageNumber: number;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

function drawHeader(context: DrawingContext, folio: string) {
  context.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 58, width: PAGE_WIDTH, height: 58, color: NAVY });
  context.page.drawText('SOLICITUD DE TRABAJO - TDCON 4.0', {
    x: MARGIN,
    y: PAGE_HEIGHT - 35,
    size: 15,
    font: context.boldFont,
    color: rgb(1, 1, 1),
  });
  context.page.drawText(`Folio: ${folio}`, {
    x: PAGE_WIDTH - MARGIN - 125,
    y: PAGE_HEIGHT - 34,
    size: 9,
    font: context.font,
    color: rgb(1, 1, 1),
  });
  context.y = PAGE_HEIGHT - 82;
}

function addPage(context: DrawingContext, folio: string) {
  context.page = context.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  context.pageNumber += 1;
  drawHeader(context, folio);
}

function ensureSpace(context: DrawingContext, height: number, folio: string) {
  if (context.y - height < 48) addPage(context, folio);
}

function drawSectionTitle(context: DrawingContext, title: string, folio: string) {
  ensureSpace(context, 34, folio);
  context.page.drawRectangle({
    x: MARGIN,
    y: context.y - 17,
    width: CONTENT_WIDTH,
    height: 23,
    color: LIGHT_BLUE,
  });
  context.page.drawText(title, {
    x: MARGIN + 8,
    y: context.y - 10,
    size: 10,
    font: context.boldFont,
    color: NAVY,
  });
  context.y -= 32;
}

function drawLabelValue(
  context: DrawingContext,
  label: string,
  value: string,
  folio: string,
) {
  ensureSpace(context, 18, folio);
  context.page.drawText(`${label}:`, {
    x: MARGIN,
    y: context.y,
    size: 9,
    font: context.boldFont,
    color: NAVY,
  });
  context.page.drawText(value || '-', {
    x: MARGIN + 130,
    y: context.y,
    size: 9,
    font: context.font,
    color: rgb(0.12, 0.14, 0.17),
  });
  context.y -= 16;
}

function drawListItem(
  context: DrawingContext,
  index: number,
  title: string,
  details: string,
  folio: string,
) {
  const titleLines = wrapText(`${index}. ${title || '-'}`, context.font, 9, CONTENT_WIDTH - 12);
  const detailLines = details
    ? wrapText(details, context.font, 8, CONTENT_WIDTH - 20)
    : [];
  const height = titleLines.length * 12 + detailLines.length * 11 + 10;
  ensureSpace(context, height, folio);
  context.page.drawLine({
    start: { x: MARGIN, y: context.y + 5 },
    end: { x: PAGE_WIDTH - MARGIN, y: context.y + 5 },
    thickness: 0.5,
    color: rgb(0.82, 0.84, 0.88),
  });
  for (const line of titleLines) {
    context.page.drawText(line, { x: MARGIN + 6, y: context.y - 7, size: 9, font: context.font });
    context.y -= 12;
  }
  for (const line of detailLines) {
    context.page.drawText(line, { x: MARGIN + 14, y: context.y - 6, size: 8, font: context.font, color: GRAY });
    context.y -= 11;
  }
  context.y -= 5;
}

function yesNoLabel(value: '' | 'YES' | 'NO') {
  if (value === 'YES') return 'Sí';
  if (value === 'NO') return 'No';
  return '-';
}

export async function generateOriginalPdf(
  folio: string,
  formData: WorkRequestFormData,
): Promise<Blob> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
  const context: DrawingContext = {
    document,
    page: document.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    font,
    boldFont,
    y: 0,
    pageNumber: 1,
  };
  drawHeader(context, folio);

  drawSectionTitle(context, 'Datos generales', folio);
  drawLabelValue(context, 'Fecha', formData.requestDate, folio);
  drawLabelValue(context, 'Proyecto / Sitio', formData.project, folio);
  drawLabelValue(context, 'Cliente', formData.client, folio);
  drawLabelValue(context, 'Ubicación', formData.location, folio);
  drawLabelValue(context, 'Solicitante', formData.requesterName, folio);
  drawLabelValue(context, 'Puesto / Cargo', formData.requesterPosition, folio);
  drawLabelValue(context, 'Finalización del alcance', formData.completionDate, folio);

  drawSectionTitle(context, 'Actividades / alcances solicitados', folio);
  formData.activities
    .filter((item) => item.description.trim() || item.observations.trim())
    .forEach((item, index) =>
      drawListItem(context, index + 1, item.description, `Observaciones: ${item.observations || '-'}`, folio),
    );

  drawSectionTitle(context, 'Personal requerido', folio);
  formData.personnel
    .filter((item) => item.role.trim())
    .forEach((item, index) => {
      const details = [
        `Cantidad: ${item.quantity ?? '-'}`,
        `Duración: ${item.duration ?? '-'} ${item.unit}`,
        `Inicio: ${item.requiredStartDate || '-'}`,
      ].join(' | ');
      drawListItem(context, index + 1, item.role, details, folio);
    });

  drawSectionTitle(context, 'Materiales requeridos', folio);
  formData.materials
    .filter((item) => item.description.trim())
    .forEach((item, index) => {
      const details = [
        `Cantidad: ${item.quantity ?? '-'} ${item.unitOfMeasure}`,
        `Marca: ${item.brand || '-'}`,
        `Modelo / Parte: ${item.partNumber || '-'}`,
        `Sustituible: ${yesNoLabel(item.isSubstitutable)}`,
        `Entrega: ${item.requiredDeliveryDate || '-'}`,
        `Alcance: ${item.scopeNotes || '-'}`,
      ].join(' | ');
      drawListItem(context, index + 1, item.description, details, folio);
    });

  addPage(context, folio);
  context.page.drawText('Firmas de aceptación', {
    x: MARGIN,
    y: 705,
    size: 13,
    font: boldFont,
    color: NAVY,
  });
  context.page.drawText('SOLICITANTE', { x: 48, y: 670, size: 9, font: boldFont, color: NAVY });
  context.page.drawText('TDCON 4.0 - LEVANTÓ SOLICITUD', { x: 322, y: 670, size: 9, font: boldFont, color: NAVY });
  context.page.drawRectangle({ x: 45, y: 490, width: 245, height: 160, borderColor: GRAY, borderWidth: 1 });
  context.page.drawRectangle({ x: 322, y: 490, width: 245, height: 160, borderColor: GRAY, borderWidth: 1 });
  context.page.drawText('Firma pendiente', { x: 130, y: 565, size: 9, font, color: GRAY });
  context.page.drawText('Firma pendiente', { x: 408, y: 565, size: 9, font, color: GRAY });

  const pages = document.getPages();
  pages.forEach((page, index) => {
    page.drawText(`Página ${index + 1} de ${pages.length}`, {
      x: PAGE_WIDTH - MARGIN - 70,
      y: 24,
      size: 8,
      font,
      color: GRAY,
    });
  });

  return pdfBytesToBlob(await document.save());
}

async function embedSignature(
  document: PDFDocument,
  page: PDFPage,
  signature: SignatureInput,
  x: number,
  font: PDFFont,
) {
  const bytes = await fetch(signature.imageDataUrl).then((response) => response.arrayBuffer());
  const image = await document.embedPng(bytes);
  page.drawRectangle({ x: x + 1, y: 491, width: 243, height: 158, color: rgb(1, 1, 1) });
  page.drawImage(image, { x: x + 14, y: 534, width: 215, height: 96 });
  page.drawText(signature.signerName, { x: x + 14, y: 515, size: 9, font, color: NAVY });
  page.drawText(signature.signerPosition, {
    x: x + 14,
    y: 503,
    size: 8,
    font,
    color: GRAY,
  });
  page.drawText(`Fecha: ${signature.signedDate}`, {
    x: x + 14,
    y: 492,
    size: 8,
    font,
    color: GRAY,
  });
}

export async function signPdf(
  originalPdf: Blob,
  signatures: SignatureInput[],
): Promise<Blob> {
  const document = await PDFDocument.load(await originalPdf.arrayBuffer());
  const font = await document.embedFont(StandardFonts.Helvetica);
  const lastPage = document.getPages().at(-1);
  if (!lastPage) throw new Error('The source PDF has no pages.');
  const requester = signatures.find((item) => item.role === 'REQUESTER');
  const tdcon = signatures.find((item) => item.role === 'TDCON');
  if (!requester || !tdcon) throw new Error('Both signatures are required.');
  await embedSignature(document, lastPage, requester, 45, font);
  await embedSignature(document, lastPage, tdcon, 322, font);
  return pdfBytesToBlob(await document.save());
}

export async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}
