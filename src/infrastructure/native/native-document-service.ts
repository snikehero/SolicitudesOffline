import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface PdfPrintPlugin {
  print(options: { data: string; jobName: string }): Promise<void>;
}

const PdfPrint = registerPlugin<PdfPrintPlugin>('PdfPrint');

export function isNativeRuntime(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 32_768;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function shareNativeBlob(blob: Blob, fileName: string): Promise<void> {
  const normalizedName = safeFileName(fileName);
  const path = `exports/${Date.now()}-${normalizedName}`;
  const { uri } = await Filesystem.writeFile({
    path,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
    recursive: true,
  });
  await Share.share({
    title: normalizedName,
    files: [uri],
    dialogTitle: 'Guardar o compartir archivo',
  });
}

export async function printNativePdf(pdf: Blob, jobName: string): Promise<void> {
  await PdfPrint.print({ data: await blobToBase64(pdf), jobName });
}
