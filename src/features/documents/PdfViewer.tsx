'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PdfViewerProps {
  blob: Blob;
}

export function PdfViewer({ blob }: PdfViewerProps) {
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [width, setWidth] = useState(680);
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100 p-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Página anterior"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((current) => current - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-24 text-center text-sm font-semibold">
            Página {pageNumber} de {pageCount || 1}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Página siguiente"
            disabled={pageNumber >= pageCount}
            onClick={() => setPageNumber((current) => current + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Alejar"
            onClick={() => setWidth((current) => Math.max(320, current - 80))}
          >
            <ZoomOut />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Acercar"
            onClick={() => setWidth((current) => Math.min(1_000, current + 80))}
          >
            <ZoomIn />
          </Button>
        </div>
      </div>
      <div className="overflow-auto rounded-xl border bg-slate-200 p-2 sm:p-4">
        <Document
          file={url}
          loading={<p className="p-8 text-center">Cargando documento...</p>}
          error={<p className="p-8 text-center text-red-700">No fue posible abrir el documento.</p>}
          onLoadSuccess={({ numPages }) => {
            setPageCount(numPages);
            setPageNumber((current) => Math.min(current, numPages));
          }}
        >
          <Page
            pageNumber={pageNumber}
            width={width}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            className="mx-auto w-fit overflow-hidden rounded-sm bg-white shadow-sm"
          />
        </Document>
      </div>
    </div>
  );
}
