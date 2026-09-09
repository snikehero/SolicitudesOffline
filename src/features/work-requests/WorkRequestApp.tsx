'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import dynamic from 'next/dynamic';
import {
  ArchiveRestore,
  ArrowLeft,
  ClipboardList,
  Download,
  FileCheck2,
  FileText,
  HardDrive,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  createActivityItem,
  createEmptyWorkRequestForm,
  createMaterialItem,
  createPersonnelItem,
  type SignatureInput,
  type WorkRequestFormData,
  type WorkRequestRecord,
} from '@/src/domain/work-requests/work-request';
import { validateWorkRequest } from '@/src/domain/work-requests/work-request-validation';
import {
  createWorkRequest,
  finalizeSignedDocument,
  getLatestDocumentVersion,
  getStorageSummary,
  listWorkRequests,
  recordDocumentOpened,
  recordPrintRequested,
  requestPersistentStorage,
  returnToDraft,
  saveOriginalPdf,
  saveWorkRequestDraft,
  statusLabel,
} from '@/src/application/work-request-service';
import { createBackup, downloadBlob, restoreBackup } from '@/src/infrastructure/backup/backup-service';
import { generateOriginalPdf, sha256, signPdf } from '@/src/infrastructure/pdf/pdf-service';
import {
  isNativeRuntime,
  printNativePdf,
  shareNativeBlob,
} from '@/src/infrastructure/native/native-document-service';
import { SignaturePad } from '@/src/features/signature/SignaturePad';

const PdfViewer = dynamic(
  () => import('@/src/features/documents/PdfViewer').then((module) => module.PdfViewer),
  { ssr: false, loading: () => <p className="py-10 text-center">Cargando visor...</p> },
);

type Screen = 'dashboard' | 'form' | 'review' | 'backup';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const ROLE_OPTIONS = [
  'Ayudante',
  'Oficial',
  'Cabo',
  'Residente',
  'Segurista',
  'Cadista',
  'Control presupuestal',
];

function formatDate(value: string): string {
  if (!value) return '-';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(date);
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusClass(status: WorkRequestRecord['status']): string {
  if (status === 'PRINT_READY' || status === 'SIGNED') return 'bg-emerald-100 text-emerald-900';
  if (status === 'PENDING_SIGNATURE') return 'bg-amber-100 text-amber-900';
  if (status === 'VOIDED') return 'bg-red-100 text-red-900';
  return 'bg-slate-100 text-slate-800';
}

interface FieldBlockProps {
  label: string;
  children: React.ReactNode;
}

function FieldBlock({ label, children }: FieldBlockProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-slate-700">{label}</Label>
      {children}
    </div>
  );
}

export function WorkRequestApp() {
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [records, setRecords] = useState<WorkRequestRecord[]>([]);
  const [activeRecord, setActiveRecord] = useState<WorkRequestRecord | null>(null);
  const [activePdf, setActivePdf] = useState<Blob | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [search, setSearch] = useState('');
  const [storage, setStorage] = useState({ usage: 0, quota: 0, persistent: false });
  const [requesterSignature, setRequesterSignature] = useState('');
  const [tdconSignature, setTdconSignature] = useState('');
  const [requesterSignerName, setRequesterSignerName] = useState('');
  const [requesterSignedDate, setRequesterSignedDate] = useState('');
  const [tdconSignerName, setTdconSignerName] = useState('');
  const [tdconSignerPosition, setTdconSignerPosition] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<WorkRequestFormData>({
    defaultValues: createEmptyWorkRequestForm(),
  });
  const activities = useFieldArray({ control: form.control, name: 'activities' });
  const personnel = useFieldArray({ control: form.control, name: 'personnel' });
  const materials = useFieldArray({ control: form.control, name: 'materials' });

  const refreshRecords = async () => {
    setRecords(await listWorkRequests());
    const summary = await getStorageSummary();
    setStorage((current) => ({ ...current, ...summary }));
  };

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    updateConnection();
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    requestPersistentStorage()
      .then((persistent) => setStorage((current) => ({ ...current, persistent })))
      .catch(() => undefined);
    refreshRecords().catch(() => setError('No fue posible abrir el historial local.'));
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  useEffect(() => {
    if (!activeRecord || activeRecord.status !== 'DRAFT' || screen !== 'form') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = form.watch(() => {
      setSaveState('saving');
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const updated = await saveWorkRequestDraft(activeRecord, form.getValues());
          setActiveRecord(updated);
          setSaveState('saved');
          await refreshRecords();
        } catch {
          setSaveState('error');
        }
      }, 700);
    });
    return () => {
      subscription.unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [activeRecord, form, screen]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-MX');
    if (!query) return records;
    return records.filter((record) =>
      [record.folio, record.client, record.requesterName]
        .join(' ')
        .toLocaleLowerCase('es-MX')
        .includes(query),
    );
  }, [records, search]);

  const pendingCount = records.filter((record) => record.status === 'PENDING_SIGNATURE').length;
  const printableCount = records.filter((record) => record.status === 'PRINT_READY').length;

  const clearMessages = () => {
    setNotice('');
    setError('');
  };

  const startNewRequest = async () => {
    clearMessages();
    try {
      const record = await createWorkRequest();
      setActiveRecord(record);
      form.reset(record.formData);
      setActivePdf(null);
      setSaveState('saved');
      setScreen('form');
      await refreshRecords();
    } catch {
      setError('No fue posible crear la solicitud. Revisa el almacenamiento disponible.');
    }
  };

  const openRecord = async (record: WorkRequestRecord) => {
    clearMessages();
    setActiveRecord(record);
    if (record.status === 'DRAFT') {
      form.reset(record.formData);
      setScreen('form');
      return;
    }
    const kind = record.status === 'PRINT_READY' || record.status === 'SIGNED' ? 'SIGNED' : 'ORIGINAL';
    const version = await getLatestDocumentVersion(record.id, kind);
    if (!version) {
      setError('No se encontró el PDF asociado con esta solicitud.');
      return;
    }
    setActivePdf(version.pdfBlob);
    setRequesterSignerName(record.formData.requesterName);
    setRequesterSignedDate(new Date().toISOString().slice(0, 10));
    setRequesterSignature('');
    setTdconSignature('');
    setScreen('review');
    await recordDocumentOpened(record.id);
  };

  const goHome = async () => {
    clearMessages();
    setActiveRecord(null);
    setActivePdf(null);
    setScreen('dashboard');
    await refreshRecords();
  };

  const generateDocument = async () => {
    if (!activeRecord) return;
    clearMessages();
    const values = form.getValues();
    const validation = validateWorkRequest(values);
    if (!validation.success) {
      setError(validation.error.issues.map((issue) => issue.message).join(' '));
      return;
    }
    try {
      setNotice('Generando documento...');
      const saved = await saveWorkRequestDraft(activeRecord, validation.data);
      const pdfBlob = await generateOriginalPdf(saved.folio, validation.data);
      const hash = await sha256(pdfBlob);
      const updated = await saveOriginalPdf(saved, pdfBlob, hash);
      setActiveRecord(updated);
      setActivePdf(pdfBlob);
      setRequesterSignerName(validation.data.requesterName);
      setRequesterSignedDate(new Date().toISOString().slice(0, 10));
      setScreen('review');
      setNotice('Documento generado. Revisa el contenido y agrega las firmas.');
      await refreshRecords();
    } catch {
      setNotice('');
      setError('No fue posible generar o guardar el PDF.');
    }
  };

  const editAgain = async () => {
    if (!activeRecord) return;
    const updated = await returnToDraft(activeRecord);
    setActiveRecord(updated);
    form.reset(updated.formData);
    setScreen('form');
    setNotice('Puedes corregir el formulario y generar una nueva versión original.');
  };

  const finalizeDocument = async () => {
    if (!activeRecord || !activePdf) return;
    clearMessages();
    if (!requesterSignature || !tdconSignature) {
      setError('Se requieren las firmas del solicitante y de TDCON.');
      return;
    }
    if (!requesterSignerName.trim() || !tdconSignerName.trim()) {
      setError('Escribe el nombre de ambas personas firmantes.');
      return;
    }
    if (!requesterSignedDate) {
      setError('Selecciona la fecha de firma del solicitante.');
      return;
    }
    const signatures: SignatureInput[] = [
      {
        role: 'REQUESTER',
        signerName: requesterSignerName.trim(),
        signerPosition: 'Solicitante',
        signedDate: requesterSignedDate,
        imageDataUrl: requesterSignature,
      },
      {
        role: 'TDCON',
        signerName: tdconSignerName.trim(),
        signerPosition: tdconSignerPosition.trim(),
        signedDate: new Date().toISOString().slice(0, 10),
        imageDataUrl: tdconSignature,
      },
    ];
    try {
      setNotice('Creando versión firmada...');
      const signedPdf = await signPdf(activePdf, signatures);
      const hash = await sha256(signedPdf);
      const updated = await finalizeSignedDocument(activeRecord, signedPdf, hash, signatures);
      setActiveRecord(updated);
      setActivePdf(signedPdf);
      setNotice('Documento firmado y listo para imprimir.');
      await refreshRecords();
    } catch {
      setNotice('');
      setError('No fue posible crear la versión firmada.');
    }
  };

  const printDocument = async () => {
    if (!activeRecord || !activePdf || activeRecord.status !== 'PRINT_READY') {
      setError('Solo se puede imprimir un documento firmado.');
      return;
    }
    try {
      if (isNativeRuntime()) {
        await printNativePdf(activePdf, activeRecord.folio);
      } else {
        const url = URL.createObjectURL(activePdf);
        const frame = document.createElement('iframe');
        frame.style.position = 'fixed';
        frame.style.width = '1px';
        frame.style.height = '1px';
        frame.style.opacity = '0';
        frame.src = url;
        frame.onload = () => window.setTimeout(() => frame.contentWindow?.print(), 300);
        document.body.appendChild(frame);
        window.setTimeout(() => {
          frame.remove();
          URL.revokeObjectURL(url);
        }, 60_000);
      }
      await recordPrintRequested(activeRecord.id);
      setNotice('Se abrió el diálogo de impresión de Android.');
    } catch {
      setError('No fue posible abrir la impresión de Android.');
    }
  };

  const savePdf = async () => {
    if (!activeRecord || !activePdf) return;
    const suffix = activeRecord.status === 'PRINT_READY' ? '_firmado' : '_original';
    const fileName = `${activeRecord.folio}${suffix}.pdf`;
    try {
      if (isNativeRuntime()) await shareNativeBlob(activePdf, fileName);
      else downloadBlob(activePdf, fileName);
    } catch {
      setError('No fue posible guardar o compartir el PDF.');
    }
  };

  const exportBackup = async () => {
    clearMessages();
    try {
      const backup = await createBackup();
      const stamp = new Date().toISOString().slice(0, 10);
      const fileName = `respaldo-tdcon-${stamp}.zip`;
      if (isNativeRuntime()) await shareNativeBlob(backup, fileName);
      else downloadBlob(backup, fileName);
      setNotice('Respaldo generado. Conserva el archivo en un lugar seguro.');
    } catch {
      setError('No fue posible generar el respaldo.');
    }
  };

  const importBackup = async (file: File) => {
    clearMessages();
    try {
      const count = await restoreBackup(file);
      await refreshRecords();
      setNotice(`Respaldo restaurado. Se procesaron ${count} solicitudes.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible restaurar el respaldo.');
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button type="button" className="text-left" onClick={goHome}>
            <p className="text-sm font-semibold text-primary">TDCON 4.0</p>
            <h1 className="text-lg font-bold tracking-tight sm:text-2xl">Solicitudes de trabajo</h1>
          </button>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="hidden min-h-12 sm:inline-flex" onClick={() => setScreen('backup')}>
              <HardDrive /> Respaldo
            </Button>
            <div className={`flex min-h-12 items-center gap-2 rounded-full px-3 text-sm font-semibold ${isOnline ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
              {isOnline ? <Wifi /> : <WifiOff />}
              <span className="hidden sm:inline">{isOnline ? 'En línea' : 'Modo offline'}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
        {(notice || error) && (
          <output className={`mb-5 block rounded-xl border px-4 py-3 text-base font-medium ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
            {error || notice}
          </output>
        )}

        {screen === 'dashboard' && (
          <section className="space-y-6">
            <div className="flex flex-col gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div>
                <p className="text-sm font-semibold text-blue-100">Captura local</p>
                <h2 className="mt-1 text-2xl font-bold">Nueva solicitud</h2>
                <p className="mt-2 max-w-xl text-base text-blue-100">Llena el formato, firma con el dedo y genera el PDF para imprimir.</p>
              </div>
              <Button size="lg" className="min-h-12 bg-white px-5 text-primary hover:bg-blue-50" onClick={startNewRequest}>
                <Plus /> Nueva solicitud
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-l-4 border-l-amber-500">
                <CardHeader><CardDescription>Pendientes de firma</CardDescription><CardTitle className="text-3xl font-bold">{pendingCount}</CardTitle></CardHeader>
                <CardContent className="flex items-center gap-2 text-muted-foreground"><ClipboardList /> Documentos generados sin finalizar</CardContent>
              </Card>
              <Card className="border-l-4 border-l-emerald-600">
                <CardHeader><CardDescription>Listos para imprimir</CardDescription><CardTitle className="text-3xl font-bold">{printableCount}</CardTitle></CardHeader>
                <CardContent className="flex items-center gap-2 text-muted-foreground"><FileCheck2 /> Documentos con ambas firmas</CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Historial local</CardTitle>
                <CardDescription>Los registros se conservan únicamente en este dispositivo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 size-5 text-muted-foreground" />
                  <Input className="min-h-12 pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por folio, cliente o solicitante" />
                </div>
                {!filteredRecords.length ? (
                  <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center text-muted-foreground">Crea tu primera solicitud para comenzar.</div>
                ) : (
                  <div className="divide-y rounded-xl border bg-white">
                    {filteredRecords.map((record) => (
                      <button key={record.id} type="button" onClick={() => openRecord(record)} className="flex min-h-20 w-full flex-col gap-2 px-4 py-3 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-bold text-primary">{record.folio}</p>
                          <p className="text-base">{record.client || 'Sin cliente'} · {record.requesterName || 'Sin solicitante'}</p>
                          <p className="text-sm text-muted-foreground">{formatDate(record.updatedAt)}</p>
                        </div>
                        <Badge className={statusClass(record.status)}>{statusLabel(record.status)}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Button variant="outline" className="min-h-12 w-full sm:hidden" onClick={() => setScreen('backup')}><HardDrive /> Respaldo y almacenamiento</Button>
          </section>
        )}

        {screen === 'form' && activeRecord && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-sm text-muted-foreground">Solicitud</p><h2 className="text-2xl font-bold text-primary">{activeRecord.folio}</h2></div>
              <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">{saveState === 'saving' ? 'Guardando...' : saveState === 'error' ? 'Error de guardado' : 'Borrador guardado'}</span><Button variant="outline" className="min-h-12" onClick={goHome}><ArrowLeft /> Salir</Button></div>
            </div>

            <Card>
              <CardHeader><CardTitle>Datos generales</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <FieldBlock label="Fecha"><Input type="date" className="min-h-12 bg-amber-50" {...form.register('requestDate')} /></FieldBlock>
                <FieldBlock label="Proyecto / Sitio"><Input className="min-h-12 bg-amber-50" {...form.register('project')} /></FieldBlock>
                <FieldBlock label="Cliente"><Input className="min-h-12 bg-amber-50" {...form.register('client')} /></FieldBlock>
                <FieldBlock label="Ubicación"><Input className="min-h-12 bg-amber-50" {...form.register('location')} /></FieldBlock>
                <FieldBlock label="Solicitante (residente)"><Input className="min-h-12 bg-amber-50" {...form.register('requesterName')} /></FieldBlock>
                <FieldBlock label="Puesto / Cargo"><Input className="min-h-12 bg-amber-50" {...form.register('requesterPosition')} /></FieldBlock>
                <FieldBlock label="Fecha de finalización del alcance"><Input type="date" className="min-h-12 bg-amber-50" {...form.register('completionDate')} /></FieldBlock>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Actividades / alcances solicitados</CardTitle><CardDescription>Una descripción y sus observaciones por actividad.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                {activities.fields.map((field, index) => (
                  <div key={field.id} className="grid gap-3 rounded-xl border bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto]">
                    <FieldBlock label={`Descripción ${index + 1}`}><Textarea className="min-h-24 bg-amber-50" {...form.register(`activities.${index}.description`)} /></FieldBlock>
                    <FieldBlock label="Observaciones"><Textarea className="min-h-24 bg-amber-50" {...form.register(`activities.${index}.observations`)} /></FieldBlock>
                    <Button type="button" variant="destructive" size="icon-lg" className="mt-7" aria-label="Eliminar actividad" disabled={activities.fields.length === 1} onClick={() => activities.remove(index)}><Trash2 /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" className="min-h-12" onClick={() => activities.append(createActivityItem())}><Plus /> Agregar actividad</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Personal requerido</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {personnel.fields.map((field, index) => (
                  <div key={field.id} className="grid gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_.7fr_.7fr_1fr_1fr_auto]">
                    <FieldBlock label="Rol / Especialidad"><NativeSelect className="w-full [&_select]:h-12 [&_select]:bg-amber-50" {...form.register(`personnel.${index}.role`)}><NativeSelectOption value="">Seleccionar...</NativeSelectOption>{ROLE_OPTIONS.map((role) => <NativeSelectOption key={role} value={role}>{role}</NativeSelectOption>)}</NativeSelect></FieldBlock>
                    <FieldBlock label="Cantidad"><Input type="number" className="min-h-12 bg-amber-50" {...form.register(`personnel.${index}.quantity`, { setValueAs: (value) => value === '' ? null : Number(value) })} /></FieldBlock>
                    <FieldBlock label="Duración"><Input type="number" className="min-h-12 bg-amber-50" {...form.register(`personnel.${index}.duration`, { setValueAs: (value) => value === '' ? null : Number(value) })} /></FieldBlock>
                    <FieldBlock label="Unidad"><Input className="min-h-12 bg-amber-50" placeholder="días, semanas..." {...form.register(`personnel.${index}.unit`)} /></FieldBlock>
                    <FieldBlock label="Inicio requerido"><Input type="date" className="min-h-12 bg-amber-50" {...form.register(`personnel.${index}.requiredStartDate`)} /></FieldBlock>
                    <Button type="button" variant="destructive" size="icon-lg" className="mt-7" aria-label="Eliminar personal" disabled={personnel.fields.length === 1} onClick={() => personnel.remove(index)}><Trash2 /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" className="min-h-12" onClick={() => personnel.append(createPersonnelItem())}><Plus /> Agregar personal</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Materiales requeridos</CardTitle><CardDescription>Agrega las partidas necesarias. No existe un límite fijo.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                {materials.fields.map((field, index) => (
                  <div key={field.id} className="space-y-3 rounded-xl border bg-slate-50 p-4">
                    <div className="flex items-center justify-between"><p className="font-bold text-primary">Material {index + 1}</p><Button type="button" variant="destructive" size="icon-lg" aria-label="Eliminar material" disabled={materials.fields.length === 1} onClick={() => materials.remove(index)}><Trash2 /></Button></div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <FieldBlock label="Equipo / Material / Descripción"><Textarea className="min-h-20 bg-amber-50" {...form.register(`materials.${index}.description`)} /></FieldBlock>
                      <FieldBlock label="Cantidad"><Input type="number" step="any" className="min-h-12 bg-amber-50" {...form.register(`materials.${index}.quantity`, { setValueAs: (value) => value === '' ? null : Number(value) })} /></FieldBlock>
                      <FieldBlock label="Unidad de medida"><Input className="min-h-12 bg-amber-50" placeholder="pza, m, kg..." {...form.register(`materials.${index}.unitOfMeasure`)} /></FieldBlock>
                      <FieldBlock label="Marca"><Input className="min-h-12 bg-amber-50" {...form.register(`materials.${index}.brand`)} /></FieldBlock>
                      <FieldBlock label="Modelo / Núm. de parte"><Input className="min-h-12 bg-amber-50" {...form.register(`materials.${index}.partNumber`)} /></FieldBlock>
                      <FieldBlock label="¿Marca / Modelo sustituible?"><NativeSelect className="w-full [&_select]:h-12 [&_select]:bg-amber-50" {...form.register(`materials.${index}.isSubstitutable`)}><NativeSelectOption value="">Seleccionar...</NativeSelectOption><NativeSelectOption value="YES">Sí</NativeSelectOption><NativeSelectOption value="NO">No</NativeSelectOption></NativeSelect></FieldBlock>
                      <FieldBlock label="Fecha de entrega requerida"><Input type="date" className="min-h-12 bg-amber-50" {...form.register(`materials.${index}.requiredDeliveryDate`)} /></FieldBlock>
                      <div className="sm:col-span-2"><FieldBlock label="Alcance / observaciones"><Textarea className="min-h-20 bg-amber-50" {...form.register(`materials.${index}.scopeNotes`)} /></FieldBlock></div>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" className="min-h-12" onClick={() => materials.append(createMaterialItem())}><Plus /> Agregar material</Button>
              </CardContent>
            </Card>

            <div className="sticky bottom-3 flex flex-col gap-2 rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end"><Button variant="outline" className="min-h-12" onClick={goHome}>Guardar y salir</Button><Button className="min-h-12 px-6" onClick={generateDocument}><FileText /> Generar documento</Button></div>
          </section>
        )}

        {screen === 'review' && activeRecord && activePdf && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">{statusLabel(activeRecord.status)}</p><h2 className="text-2xl font-bold text-primary">{activeRecord.folio}</h2></div><Button variant="outline" className="min-h-12" onClick={goHome}><ArrowLeft /> Historial</Button></div>
            <Card><CardHeader><CardTitle>Vista previa del PDF</CardTitle><CardDescription>La versión mostrada está guardada localmente.</CardDescription></CardHeader><CardContent><PdfViewer blob={activePdf} /></CardContent></Card>

            {activeRecord.status === 'PENDING_SIGNATURE' && (
              <Card>
                <CardHeader><CardTitle>Firmas de aceptación</CardTitle><CardDescription>Ambas firmas quedarán incrustadas permanentemente en una nueva versión del PDF.</CardDescription></CardHeader>
                <CardContent className="grid gap-8 lg:grid-cols-2">
                  <div className="space-y-4"><SignaturePad label="Solicitante" value={requesterSignature} onChange={setRequesterSignature} /><FieldBlock label="Nombre"><Input className="min-h-12 bg-amber-50" value={requesterSignerName} onChange={(event) => setRequesterSignerName(event.target.value)} /></FieldBlock><FieldBlock label="Fecha"><Input type="date" className="min-h-12 bg-amber-50" value={requesterSignedDate} onChange={(event) => setRequesterSignedDate(event.target.value)} /></FieldBlock></div>
                  <div className="space-y-4"><SignaturePad label="TDCON 4.0 - Levantó solicitud" value={tdconSignature} onChange={setTdconSignature} /><FieldBlock label="Nombre"><Input className="min-h-12 bg-amber-50" value={tdconSignerName} onChange={(event) => setTdconSignerName(event.target.value)} /></FieldBlock><FieldBlock label="Puesto"><Input className="min-h-12 bg-amber-50" value={tdconSignerPosition} onChange={(event) => setTdconSignerPosition(event.target.value)} /></FieldBlock></div>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:flex-row sm:justify-end">
              {activeRecord.status === 'PENDING_SIGNATURE' && <><Button variant="outline" className="min-h-12" onClick={editAgain}>Corregir formulario</Button><Button className="min-h-12 px-6" onClick={finalizeDocument}><ShieldCheck /> Confirmar firmas y finalizar</Button></>}
              {activeRecord.status === 'PRINT_READY' && <><Button variant="outline" className="min-h-12" onClick={savePdf}><Download /> Guardar PDF</Button><Button className="min-h-12 px-6" onClick={printDocument}><Printer /> Imprimir documento</Button></>}
            </div>
          </section>
        )}

        {screen === 'backup' && (
          <section className="space-y-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Administración local</p><h2 className="text-2xl font-bold text-primary">Respaldo y almacenamiento</h2></div><Button variant="outline" className="min-h-12" onClick={goHome}><ArrowLeft /> Volver</Button></div>
            <Card>
              <CardHeader><CardTitle>Estado del almacenamiento</CardTitle><CardDescription>{storage.persistent ? 'El navegador concedió almacenamiento persistente.' : 'El navegador administra la permanencia de estos datos.'}</CardDescription></CardHeader>
              <CardContent className="space-y-3"><p className="text-lg font-semibold">{formatBytes(storage.usage)} utilizados {storage.quota ? `de ${formatBytes(storage.quota)}` : ''}</p><div className="h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-primary" style={{ width: storage.quota ? `${Math.min(100, (storage.usage / storage.quota) * 100)}%` : '0%' }} /></div></CardContent>
            </Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Card><CardHeader><CardTitle>Exportar respaldo</CardTitle><CardDescription>Guarda solicitudes, PDF, firmas y auditoría en un archivo ZIP.</CardDescription></CardHeader><CardContent><Button className="min-h-12 w-full" onClick={exportBackup}><Download /> Exportar respaldo</Button></CardContent></Card>
              <Card><CardHeader><CardTitle>Importar respaldo</CardTitle><CardDescription>Restaura un archivo creado por esta aplicación.</CardDescription></CardHeader><CardContent><input ref={importInputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBackup(file); event.currentTarget.value = ''; }} /><Button variant="outline" className="min-h-12 w-full" onClick={() => importInputRef.current?.click()}><Upload /> Seleccionar respaldo</Button></CardContent></Card>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><div className="flex gap-3"><ArchiveRestore className="mt-0.5 shrink-0" /><div><p className="font-bold">Conserva copias externas</p><p className="mt-1">Borrar los datos del navegador o desinstalar la PWA puede eliminar el historial local.</p></div></div></div>
          </section>
        )}
      </div>
    </main>
  );
}
