import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyWorkRequestForm } from '@/src/domain/work-requests/work-request';
import { generateMaterialRequisitionWorkbook } from './material-requisition-exporter';

describe('material requisition exporter', () => {
  it('fills the supplied template while preserving its formulas', async () => {
    const template = await readFile(
      resolve(process.cwd(), 'public/templates/TDC-FR-COM-005-requisicion-material.xlsx'),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(template, { status: 200 })),
    );

    const form = createEmptyWorkRequestForm();
    form.project = 'Planta Norte';
    form.client = 'Cliente de prueba';
    form.location = 'San Luis Potosí';
    form.materials = [
      {
        ...form.materials[0],
        description: 'Cable de fuerza',
        quantity: 12,
        unitOfMeasure: 'm',
        brand: 'Marca A',
        partNumber: 'CF-001',
        isSubstitutable: 'YES',
        requiredDeliveryDate: '2026-09-15',
        scopeNotes: 'Para tablero principal',
      },
    ];

    const output = await generateMaterialRequisitionWorkbook(form);
    const zip = await JSZip.loadAsync(await output.arrayBuffer());
    const sheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('string');

    expect(sheetXml).toContain('Planta Norte');
    expect(sheetXml).toContain('Cliente de prueba');
    expect(sheetXml).toContain('Cable de fuerza');
    expect(sheetXml).toContain('Alcance / observaciones: Para tablero principal');
    expect(sheetXml).toContain('<v>12</v>');
    expect(sheetXml).toContain('MAX(B13-J13,0)');
    expect(sheetXml).toContain('M13*L13');
  });
});
