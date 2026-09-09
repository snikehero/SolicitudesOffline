import JSZip from 'jszip';
import type { WorkRequestFormData } from '@/src/domain/work-requests/work-request';

const TEMPLATE_PATH = 'templates/TDC-FR-COM-005-requisicion-material.xlsx';
const FIRST_MATERIAL_ROW = 13;
const LAST_MATERIAL_ROW = 32;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function cellPattern(address: string): RegExp {
  return new RegExp(`<c\\b(?=[^>]*\\br="${address}"[^>]*)([^>]*?)(?:/>|>[\\s\\S]*?<\\/c>)`);
}

function cellAttributes(xml: string): string {
  const attributes = xml.match(/^<c\b([^>]*?)(?:\/>|>)/)?.[1];
  if (attributes === undefined) throw new Error('No se encontró la celda de la plantilla.');
  return attributes.replace(/\s+t="[^"]*"/g, '');
}

function setInlineString(sheetXml: string, address: string, value: string): string {
  const pattern = cellPattern(address);
  if (!pattern.test(sheetXml)) throw new Error(`La plantilla no contiene la celda ${address}.`);
  const current = sheetXml.match(pattern)?.[0] ?? '';
  const attributes = cellAttributes(current);
  const content = escapeXml(value);
  return sheetXml.replace(
    pattern,
    `<c${attributes} t="inlineStr"><is><t xml:space="preserve">${content}</t></is></c>`,
  );
}

function setNumber(sheetXml: string, address: string, value: number | null): string {
  const pattern = cellPattern(address);
  if (!pattern.test(sheetXml)) throw new Error(`La plantilla no contiene la celda ${address}.`);
  const current = sheetXml.match(pattern)?.[0] ?? '';
  const attributes = cellAttributes(current);
  return sheetXml.replace(
    pattern,
    value === null ? `<c${attributes}/>` : `<c${attributes}><v>${value}</v></c>`,
  );
}

function excelSerial(dateValue: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((date.getTime() - EXCEL_EPOCH) / 86_400_000);
}

function numericValue(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function materialDescription(description: string, scopeNotes: string): string {
  if (!scopeNotes.trim()) return description;
  if (!description.trim()) return `Alcance / observaciones: ${scopeNotes.trim()}`;
  return `${description}\nAlcance / observaciones: ${scopeNotes.trim()}`;
}

function updateCalculationMode(workbookXml: string): string {
  if (workbookXml.includes('<calcPr')) {
    return workbookXml.replace(/<calcPr[^>]*\/>/, '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>');
  }
  return workbookXml.replace('</workbook>', '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>');
}

export async function generateMaterialRequisitionWorkbook(
  formData: WorkRequestFormData,
): Promise<Blob> {
  const response = await fetch(TEMPLATE_PATH);
  if (!response.ok) throw new Error('No fue posible cargar la plantilla de requisición.');

  const materials = formData.materials.filter((item) =>
    [item.description, item.unitOfMeasure, item.brand, item.partNumber, item.scopeNotes].some((value) => value.trim()) ||
    item.quantity !== null,
  );
  if (!materials.length) throw new Error('Agrega al menos un material antes de exportar.');
  if (materials.length > LAST_MATERIAL_ROW - FIRST_MATERIAL_ROW + 1) {
    throw new Error('La plantilla admite un máximo de 20 materiales.');
  }

  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  let sheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('string');
  const workbookXml = await zip.file('xl/workbook.xml')?.async('string');
  if (!sheetXml || !workbookXml) throw new Error('La plantilla no tiene una hoja de cálculo válida.');

  sheetXml = setInlineString(sheetXml, 'D8', formData.project.trim());
  sheetXml = setInlineString(sheetXml, 'D9', formData.client.trim());
  const requestDate = excelSerial(formData.requestDate);
  sheetXml = setNumber(sheetXml, 'I3', requestDate);

  for (let index = 0; index < LAST_MATERIAL_ROW - FIRST_MATERIAL_ROW + 1; index += 1) {
    const row = FIRST_MATERIAL_ROW + index;
    const material = materials[index];
    sheetXml = setNumber(sheetXml, `B${row}`, numericValue(material?.quantity ?? null));
    sheetXml = setInlineString(sheetXml, `C${row}`, material?.unitOfMeasure.trim() ?? '');
    sheetXml = setInlineString(sheetXml, `D${row}`, material ? materialDescription(material.description.trim(), material.scopeNotes) : '');
    sheetXml = setInlineString(sheetXml, `E${row}`, material?.brand.trim() ?? '');
    sheetXml = setInlineString(sheetXml, `F${row}`, material?.partNumber.trim() ?? '');
    sheetXml = setInlineString(
      sheetXml,
      `G${row}`,
      material?.isSubstitutable === 'YES' ? 'Sí' : material?.isSubstitutable === 'NO' ? 'No' : '',
    );
    sheetXml = setInlineString(sheetXml, `H${row}`, formData.location.trim());
    sheetXml = setNumber(sheetXml, `I${row}`, excelSerial(material?.requiredDeliveryDate ?? ''));
  }

  zip.file('xl/worksheets/sheet1.xml', sheetXml);
  zip.file('xl/workbook.xml', updateCalculationMode(workbookXml));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
