export type WorkRequestStatus =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'SIGNED'
  | 'PRINT_READY'
  | 'VOIDED';

export type DocumentVersionKind = 'ORIGINAL' | 'SIGNED';
export type SignatureRole = 'REQUESTER' | 'TDCON';

export interface ActivityItem {
  id: string;
  description: string;
  observations: string;
}

export interface PersonnelItem {
  id: string;
  role: string;
  quantity: number | null;
  duration: number | null;
  unit: string;
  requiredStartDate: string;
}

export interface MaterialItem {
  id: string;
  description: string;
  quantity: number | null;
  unitOfMeasure: string;
  brand: string;
  partNumber: string;
  isSubstitutable: '' | 'YES' | 'NO';
  requiredDeliveryDate: string;
  scopeNotes: string;
}

export interface WorkRequestFormData {
  requestDate: string;
  project: string;
  client: string;
  location: string;
  requesterName: string;
  requesterPosition: string;
  completionDate: string;
  activities: ActivityItem[];
  personnel: PersonnelItem[];
  materials: MaterialItem[];
}

export interface WorkRequestRecord {
  id: string;
  folio: string;
  status: WorkRequestStatus;
  createdAt: string;
  updatedAt: string;
  signedAt?: string;
  deviceInstallationId: string;
  client: string;
  requesterName: string;
  requestDate: string;
  formData: WorkRequestFormData;
}

export interface DocumentVersionRecord {
  id: string;
  workRequestId: string;
  kind: DocumentVersionKind;
  pdfBlob: Blob;
  createdAt: string;
  size: number;
  sha256: string;
}

export interface SignatureRecord {
  id: string;
  workRequestId: string;
  role: SignatureRole;
  signerName: string;
  signerPosition: string;
  signedDate: string;
  imageDataUrl: string;
  createdAt: string;
}

export type AuditAction =
  | 'CREATED'
  | 'DRAFT_SAVED'
  | 'PDF_GENERATED'
  | 'SIGNATURE_CAPTURED'
  | 'SIGNED_PDF_CREATED'
  | 'PDF_OPENED'
  | 'PRINT_REQUESTED'
  | 'BACKUP_EXPORTED'
  | 'BACKUP_IMPORTED'
  | 'VOIDED';

export interface AuditEventRecord {
  id: string;
  workRequestId: string;
  action: AuditAction;
  timestamp: string;
  deviceInstallationId: string;
  details?: string;
}

export interface AppSettingRecord {
  key: string;
  value: string;
}

export interface SignatureInput {
  role: SignatureRole;
  signerName: string;
  signerPosition: string;
  signedDate: string;
  imageDataUrl: string;
}

export function createEmptyWorkRequestForm(): WorkRequestFormData {
  const today = new Date().toISOString().slice(0, 10);
  return {
    requestDate: today,
    project: '',
    client: '',
    location: '',
    requesterName: '',
    requesterPosition: '',
    completionDate: '',
    activities: [createActivityItem()],
    personnel: [createPersonnelItem()],
    materials: [createMaterialItem()],
  };
}

export function createActivityItem(): ActivityItem {
  return { id: crypto.randomUUID(), description: '', observations: '' };
}

export function createPersonnelItem(): PersonnelItem {
  return {
    id: crypto.randomUUID(),
    role: '',
    quantity: null,
    duration: null,
    unit: '',
    requiredStartDate: '',
  };
}

export function createMaterialItem(): MaterialItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    quantity: null,
    unitOfMeasure: '',
    brand: '',
    partNumber: '',
    isSubstitutable: '',
    requiredDeliveryDate: '',
    scopeNotes: '',
  };
}
