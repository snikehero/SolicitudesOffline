import type { Metadata } from 'next';
import './globals.css';
import { PwaController } from '@/src/infrastructure/pwa/PwaController';
import { WebMcpController } from '@/src/infrastructure/webmcp/WebMcpController';

export const metadata: Metadata = {
  title: 'Solicitudes TDCON',
  description: 'Solicitudes de trabajo, firmas y PDF con operación offline.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-MX">
      <body>
        {children}
        <PwaController />
        <WebMcpController />
      </body>
    </html>
  );
}
