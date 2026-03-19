
import './globals.css';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Metamorfosis — Taller (Marzo 2026)',
  description:
    'Metamorfosis: taller vivencial con psicología aplicada. Video explicativo, detalles del proceso y contacto directo por WhatsApp.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
