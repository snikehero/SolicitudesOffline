import { describe, expect, it } from 'vitest';
import { createEmptyWorkRequestForm } from '@/src/domain/work-requests/work-request';
import { generateOriginalPdf, sha256, signPdf } from './pdf-service';

const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+4h1XAAAAAElFTkSuQmCC';

describe('PDF workflow', () => {
  it('creates distinct original and signed PDF blobs', async () => {
    const form = createEmptyWorkRequestForm();
    form.project = 'Planta Norte';
    form.client = 'Cliente de prueba';
    form.requesterName = 'Juan Pérez';
    form.activities[0].description = 'Revisión de instalación';
    const original = await generateOriginalPdf('ST-2026-0001', form);
    const signed = await signPdf(original, [
      {
        role: 'REQUESTER',
        signerName: 'Juan Pérez',
        signerPosition: 'Solicitante',
        signedDate: '2026-09-08',
        imageDataUrl: ONE_PIXEL_PNG,
      },
      {
        role: 'TDCON',
        signerName: 'María López',
        signerPosition: 'Residente',
        signedDate: '2026-09-08',
        imageDataUrl: ONE_PIXEL_PNG,
      },
    ]);
    expect(original.type).toBe('application/pdf');
    expect(signed.type).toBe('application/pdf');
    expect(signed.size).toBeGreaterThan(original.size);
    expect(await sha256(signed)).toMatch(/^[a-f0-9]{64}$/);
  });
});
