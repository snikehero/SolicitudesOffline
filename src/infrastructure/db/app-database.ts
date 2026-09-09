import Dexie, { type EntityTable } from 'dexie';
import type {
  AppSettingRecord,
  AuditEventRecord,
  DocumentVersionRecord,
  SignatureRecord,
  WorkRequestRecord,
} from '@/src/domain/work-requests/work-request';

export class AppDatabase extends Dexie {
  workRequests!: EntityTable<WorkRequestRecord, 'id'>;
  documentVersions!: EntityTable<DocumentVersionRecord, 'id'>;
  signatures!: EntityTable<SignatureRecord, 'id'>;
  auditEvents!: EntityTable<AuditEventRecord, 'id'>;
  settings!: EntityTable<AppSettingRecord, 'key'>;

  constructor() {
    super('tdcon-work-requests');
    this.version(1).stores({
      workRequests: 'id,&folio,status,createdAt,updatedAt,client,requesterName,requestDate',
      documentVersions: 'id,workRequestId,[workRequestId+kind],kind,createdAt',
      signatures: 'id,workRequestId,[workRequestId+role],role,createdAt',
      auditEvents: 'id,workRequestId,action,timestamp',
      settings: 'key',
    });
  }
}

export const appDatabase = new AppDatabase();
