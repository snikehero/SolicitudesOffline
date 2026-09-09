import { describe, expect, it } from 'vitest';
import { createEmptyWorkRequestForm } from './work-request';
import { validateWorkRequest } from './work-request-validation';

describe('validateWorkRequest', () => {
  it('accepts a complete minimum request', () => {
    const form = createEmptyWorkRequestForm();
    form.project = 'Planta Norte';
    form.client = 'Cliente de prueba';
    form.requesterName = 'Juan Pérez';
    form.activities[0].description = 'Revisión de instalación';
    expect(validateWorkRequest(form).success).toBe(true);
  });

  it('rejects a request without an activity description', () => {
    const form = createEmptyWorkRequestForm();
    form.project = 'Planta Norte';
    form.client = 'Cliente de prueba';
    form.requesterName = 'Juan Pérez';
    expect(validateWorkRequest(form).success).toBe(false);
  });
});
