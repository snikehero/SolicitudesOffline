import { z } from 'zod';

const requiredText = (message: string) => z.string().trim().min(1, message);

export const workRequestSchema = z.object({
  requestDate: requiredText('La fecha es obligatoria.'),
  project: requiredText('El proyecto o sitio es obligatorio.'),
  client: requiredText('El cliente es obligatorio.'),
  location: z.string(),
  requesterName: requiredText('El solicitante es obligatorio.'),
  requesterPosition: z.string(),
  completionDate: z.string(),
  activities: z
    .array(
      z.object({
        id: z.string(),
        description: z.string(),
        observations: z.string(),
      }),
    )
    .refine((items) => items.some((item) => item.description.trim()), {
      message: 'Agrega al menos una actividad con descripción.',
    }),
  personnel: z.array(
    z.object({
      id: z.string(),
      role: z.string(),
      quantity: z.number().nullable(),
      duration: z.number().nullable(),
      unit: z.string(),
      requiredStartDate: z.string(),
    }),
  ),
  materials: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      quantity: z.number().nullable(),
      unitOfMeasure: z.string(),
      brand: z.string(),
      partNumber: z.string(),
      isSubstitutable: z.union([
        z.literal(''),
        z.literal('YES'),
        z.literal('NO'),
      ]),
      requiredDeliveryDate: z.string(),
      scopeNotes: z.string(),
    }),
  ),
});

export function validateWorkRequest(input: unknown) {
  return workRequestSchema.safeParse(input);
}
