'use client';

import { useEffect, useRef } from 'react';
import SignaturePadLibrary from 'signature_pad';
import { Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SignaturePadProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function SignaturePad({ label, value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signatureRef = useRef<SignaturePadLibrary | null>(null);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!value) signatureRef.current?.clear();
  }, [value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const signature = new SignaturePadLibrary(canvas, {
      minWidth: 1,
      maxWidth: 3,
      penColor: '#1f3864',
      backgroundColor: 'rgba(255,255,255,0)',
    });
    signatureRef.current = signature;

    const resize = () => {
      const savedData = signature.toData();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      signature.clear();
      if (savedData.length) signature.fromData(savedData);
      else if (initialValueRef.current) {
        signature.fromDataURL(initialValueRef.current).catch(() => signature.clear());
      }
    };
    const save = () => {
      onChangeRef.current(signature.isEmpty() ? '' : signature.toDataURL('image/png'));
    };
    resize();
    signature.addEventListener('endStroke', save);
    window.addEventListener('resize', resize);
    return () => {
      signature.removeEventListener('endStroke', save);
      window.removeEventListener('resize', resize);
      signature.off();
    };
  }, []);

  const clear = () => {
    signatureRef.current?.clear();
    onChange('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-primary">{label}</p>
        <Button type="button" variant="outline" className="min-h-12" onClick={clear}>
          <Eraser aria-hidden="true" />
          Limpiar
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          className="block h-48 w-full touch-none sm:h-56"
          aria-label={`Área de firma: ${label}`}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Firma con el dedo o con un stylus dentro del recuadro.
      </p>
    </div>
  );
}
