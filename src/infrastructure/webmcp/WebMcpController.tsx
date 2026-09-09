'use client';

import { useEffect } from 'react';
import { listWorkRequests } from '@/src/application/work-request-service';

export function WebMcpController() {
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'read_work_request_summary',
            title: 'Consultar resumen de solicitudes',
            description: 'Devuelve el total local de solicitudes por estado sin modificar datos.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: true, untrustedContentHint: false },
            async execute() {
              const records = await listWorkRequests();
              return {
                total: records.length,
                drafts: records.filter((record) => record.status === 'DRAFT').length,
                pendingSignature: records.filter((record) => record.status === 'PENDING_SIGNATURE').length,
                printReady: records.filter((record) => record.status === 'PRINT_READY').length,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);
    } catch {
      return;
    }
    return () => lifecycle.abort();
  }, []);

  return null;
}
