import { appDatabase } from '@/src/infrastructure/db/app-database';
import { createEmptyWorkRequestForm } from '@/src/domain/work-requests/work-request';
import type {
  AuditAction,
  DocumentVersionKind,
  DocumentVersionRecord,
  SignatureInput,
  SignatureRecord,
  WorkRequestFormData,
  WorkRequestRecord,
  WorkRequestStatus,
} from '@/src/domain/work-requests/work-request';

const DEVICE_SETTING_KEY = 'deviceInstallationId';

function nowIso(): string {
  return new Date().toISOString();
}

async function getDeviceInstallationId(): Promise<string> {
  const existing = await appDatabase.settings.get(DEVICE_SETTING_KEY);
  if (existing) return existing.value;
  const value = crypto.randomUUID();
  await appDatabase.settings.put({ key: DEVICE_SETTING_KEY, value });
  return value;
}

async function addAuditEvent(
  workRequestId: string,
  action: AuditAction,
  details?: string,
): Promise<void> {
  await appDatabase.auditEvents.add({
    id: crypto.randomUUID(),
    workRequestId,
    action,
    timestamp: nowIso(),
    deviceInstallationId: await getDeviceInstallationId(),
    details,
  });
}

async function nextFolio(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `folioCounter:${year}`;
  return appDatabase.transaction('rw', appDatabase.settings, async () => {
    const current = await appDatabase.settings.get(key);
    const next = Number(current?.value ?? 0) + 1;
    await appDatabase.settings.put({ key, value: String(next) });
    return `ST-${year}-${String(next).padStart(4, '0')}`;
  });
}

export async function createWorkRequest(): Promise<WorkRequestRecord> {
  const timestamp = nowIso();
  const record: WorkRequestRecord = {
    id: crypto.randomUUID(),
    folio: await nextFolio(),
    status: 'DRAFT',
    createdAt: timestamp,
    updatedAt: timestamp,
    deviceInstallationId: await getDeviceInstallationId(),
    client: '',
    requesterName: '',
    requestDate: timestamp.slice(0, 10),
    formData: createEmptyWorkRequestForm(),
  };

  await appDatabase.transaction(
    'rw',
    [appDatabase.workRequests, appDatabase.auditEvents, appDatabase.settings],
    async () => {
      await appDatabase.workRequests.add(record);
      await addAuditEvent(record.id, 'CREATED');
    },
  );
  return record;
}

export async function saveWorkRequestDraft(
  record: WorkRequestRecord,
  formData: WorkRequestFormData,
): Promise<WorkRequestRecord> {
  if (record.status !== 'DRAFT') {
    throw new Error('Only draft work requests can be edited.');
  }
  const updated: WorkRequestRecord = {
    ...record,
    updatedAt: nowIso(),
    client: formData.client,
    requesterName: formData.requesterName,
    requestDate: formData.requestDate,
    formData,
  };
  await appDatabase.workRequests.put(updated);
  return updated;
}

export async function listWorkRequests(): Promise<WorkRequestRecord[]> {
  return appDatabase.workRequests.orderBy('updatedAt').reverse().toArray();
}

export async function getWorkRequest(id: string): Promise<WorkRequestRecord | undefined> {
  return appDatabase.workRequests.get(id);
}

export async function saveOriginalPdf(
  record: WorkRequestRecord,
  pdfBlob: Blob,
  sha256: string,
): Promise<WorkRequestRecord> {
  const timestamp = nowIso();
  const version: DocumentVersionRecord = {
    id: crypto.randomUUID(),
    workRequestId: record.id,
    kind: 'ORIGINAL',
    pdfBlob,
    createdAt: timestamp,
    size: pdfBlob.size,
    sha256,
  };
  const updated = { ...record, status: 'PENDING_SIGNATURE' as const, updatedAt: timestamp };
  await appDatabase.transaction(
    'rw',
    [
      appDatabase.documentVersions,
      appDatabase.workRequests,
      appDatabase.auditEvents,
      appDatabase.settings,
    ],
    async () => {
      await appDatabase.documentVersions.add(version);
      await appDatabase.workRequests.put(updated);
      await addAuditEvent(record.id, 'PDF_GENERATED', version.id);
    },
  );
  return updated;
}

export async function returnToDraft(record: WorkRequestRecord): Promise<WorkRequestRecord> {
  const updated = { ...record, status: 'DRAFT' as const, updatedAt: nowIso() };
  await appDatabase.workRequests.put(updated);
  return updated;
}

export async function finalizeSignedDocument(
  record: WorkRequestRecord,
  signedPdfBlob: Blob,
  sha256: string,
  signatures: SignatureInput[],
): Promise<WorkRequestRecord> {
  if (record.status !== 'PENDING_SIGNATURE') {
    throw new Error('The document is not ready for signatures.');
  }
  const timestamp = nowIso();
  const version: DocumentVersionRecord = {
    id: crypto.randomUUID(),
    workRequestId: record.id,
    kind: 'SIGNED',
    pdfBlob: signedPdfBlob,
    createdAt: timestamp,
    size: signedPdfBlob.size,
    sha256,
  };
  const signatureRecords: SignatureRecord[] = signatures.map((signature) => ({
    id: crypto.randomUUID(),
    workRequestId: record.id,
    role: signature.role,
    signerName: signature.signerName,
    signerPosition: signature.signerPosition,
    signedDate: signature.signedDate,
    imageDataUrl: signature.imageDataUrl,
    createdAt: timestamp,
  }));
  const updated: WorkRequestRecord = {
    ...record,
    status: 'PRINT_READY',
    signedAt: timestamp,
    updatedAt: timestamp,
  };

  await appDatabase.transaction(
    'rw',
    [
      appDatabase.documentVersions,
      appDatabase.signatures,
      appDatabase.workRequests,
      appDatabase.auditEvents,
      appDatabase.settings,
    ],
    async () => {
      await appDatabase.documentVersions.add(version);
      await appDatabase.signatures.bulkAdd(signatureRecords);
      await appDatabase.workRequests.put(updated);
      for (const signature of signatureRecords) {
        await addAuditEvent(record.id, 'SIGNATURE_CAPTURED', signature.role);
      }
      await addAuditEvent(record.id, 'SIGNED_PDF_CREATED', version.id);
    },
  );
  return updated;
}

export async function getLatestDocumentVersion(
  workRequestId: string,
  kind: DocumentVersionKind,
): Promise<DocumentVersionRecord | undefined> {
  const versions = await appDatabase.documentVersions
    .where('[workRequestId+kind]')
    .equals([workRequestId, kind])
    .toArray();
  return versions.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

export async function recordDocumentOpened(workRequestId: string): Promise<void> {
  await addAuditEvent(workRequestId, 'PDF_OPENED');
}

export async function recordPrintRequested(workRequestId: string): Promise<void> {
  await addAuditEvent(workRequestId, 'PRINT_REQUESTED');
}

export async function getStorageSummary(): Promise<{ usage: number; quota: number }> {
  const estimate = await navigator.storage?.estimate?.();
  return { usage: estimate?.usage ?? 0, quota: estimate?.quota ?? 0 };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export async function getAllBackupData() {
  return {
    workRequests: await appDatabase.workRequests.toArray(),
    documentVersions: await appDatabase.documentVersions.toArray(),
    signatures: await appDatabase.signatures.toArray(),
    auditEvents: await appDatabase.auditEvents.toArray(),
    settings: await appDatabase.settings.toArray(),
  };
}

export async function importBackupData(data: {
  workRequests: WorkRequestRecord[];
  documentVersions: DocumentVersionRecord[];
  signatures: SignatureRecord[];
  auditEvents: import('@/src/domain/work-requests/work-request').AuditEventRecord[];
  settings: import('@/src/domain/work-requests/work-request').AppSettingRecord[];
}): Promise<void> {
  await appDatabase.transaction(
    'rw',
    [
      appDatabase.workRequests,
      appDatabase.documentVersions,
      appDatabase.signatures,
      appDatabase.auditEvents,
      appDatabase.settings,
    ],
    async () => {
      await appDatabase.workRequests.bulkPut(data.workRequests);
      await appDatabase.documentVersions.bulkPut(data.documentVersions);
      await appDatabase.signatures.bulkPut(data.signatures);
      await appDatabase.auditEvents.bulkPut(data.auditEvents);
      await appDatabase.settings.bulkPut(data.settings);
    },
  );
}

export function statusLabel(status: WorkRequestStatus): string {
  const labels: Record<WorkRequestStatus, string> = {
    DRAFT: 'Borrador',
    PENDING_SIGNATURE: 'Pendiente de firma',
    SIGNED: 'Firmado',
    PRINT_READY: 'Listo para imprimir',
    VOIDED: 'Anulado',
  };
  return labels[status];
}
