import JSZip from 'jszip';
import { appDatabase } from '@/src/infrastructure/db/app-database';
import type {
  AppSettingRecord,
  AuditEventRecord,
  DocumentVersionKind,
  DocumentVersionRecord,
  SignatureRecord,
  WorkRequestRecord,
} from '@/src/domain/work-requests/work-request';

interface BackupDocumentVersion {
  id: string;
  workRequestId: string;
  kind: DocumentVersionKind;
  createdAt: string;
  size: number;
  sha256: string;
  fileName: string;
}

interface BackupManifest {
  schemaVersion: 1;
  exportedAt: string;
  workRequests: WorkRequestRecord[];
  documentVersions: BackupDocumentVersion[];
  signatures: SignatureRecord[];
  auditEvents: AuditEventRecord[];
  settings: AppSettingRecord[];
}

export async function createBackup(): Promise<Blob> {
  const [workRequests, documentVersions, signatures, auditEvents, settings] =
    await Promise.all([
      appDatabase.workRequests.toArray(),
      appDatabase.documentVersions.toArray(),
      appDatabase.signatures.toArray(),
      appDatabase.auditEvents.toArray(),
      appDatabase.settings.toArray(),
    ]);

  const zip = new JSZip();
  const backupVersions: BackupDocumentVersion[] = [];
  for (const version of documentVersions) {
    const fileName = `pdf/${version.workRequestId}/${version.id}-${version.kind.toLowerCase()}.pdf`;
    zip.file(fileName, version.pdfBlob);
    const { pdfBlob: _pdfBlob, ...metadata } = version;
    backupVersions.push({ ...metadata, fileName });
  }

  const manifest: BackupManifest = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    workRequests,
    documentVersions: backupVersions,
    signatures,
    auditEvents,
    settings,
  };
  zip.file('metadata.json', JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

function isBackupManifest(value: unknown): value is BackupManifest {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<BackupManifest>;
  return (
    record.schemaVersion === 1 &&
    Array.isArray(record.workRequests) &&
    Array.isArray(record.documentVersions) &&
    Array.isArray(record.signatures) &&
    Array.isArray(record.auditEvents) &&
    Array.isArray(record.settings)
  );
}

export async function restoreBackup(file: File): Promise<number> {
  const zip = await JSZip.loadAsync(file);
  const metadataFile = zip.file('metadata.json');
  if (!metadataFile) throw new Error('El respaldo no contiene metadata.json.');
  const parsed: unknown = JSON.parse(await metadataFile.async('string'));
  if (!isBackupManifest(parsed)) {
    throw new Error('El formato o la versión del respaldo no es compatible.');
  }

  const versions: DocumentVersionRecord[] = [];
  for (const metadata of parsed.documentVersions) {
    const pdfFile = zip.file(metadata.fileName);
    if (!pdfFile) throw new Error(`Falta el archivo ${metadata.fileName}.`);
    const pdfBlob = await pdfFile.async('blob');
    versions.push({
      id: metadata.id,
      workRequestId: metadata.workRequestId,
      kind: metadata.kind,
      createdAt: metadata.createdAt,
      size: metadata.size,
      sha256: metadata.sha256,
      pdfBlob: new Blob([pdfBlob], { type: 'application/pdf' }),
    });
  }

  // A restored backup must never replace the identity of the current installation.
  const portableSettings = parsed.settings.filter(
    (setting) => setting.key !== 'deviceInstallationId',
  );

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
      await appDatabase.workRequests.bulkPut(parsed.workRequests);
      await appDatabase.documentVersions.bulkPut(versions);
      await appDatabase.signatures.bulkPut(parsed.signatures);
      await appDatabase.auditEvents.bulkPut(parsed.auditEvents);
      await appDatabase.settings.bulkPut(portableSettings);
    },
  );
  return parsed.workRequests.length;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
