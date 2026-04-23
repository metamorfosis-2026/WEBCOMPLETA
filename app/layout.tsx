import './globals.css';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Metamorfosis \u2014 Taller (Marzo 2026)',
  description:
    'Metamorfosis: taller vivencial con psicolog\u00eda aplicada. Video explicativo, detalles del proceso y contacto directo por WhatsApp.',
  icons: {
    icon: 'https://pub-a6844436cdf343eca77a9769bb10e73e.r2.dev/favicon.ico',
    shortcut: 'https://pub-a6844436cdf343eca77a9769bb10e73e.r2.dev/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
