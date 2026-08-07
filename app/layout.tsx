import './globals.css';

import type { Metadata } from 'next';
import { Manrope, Outfit } from 'next/font/google';

/*
  Tipografia de marca:
  - Outfit para titulos: geometrica, moderna, y en pesos livianos a tamaño
    grande da el aire "premium" sin caer en serif.
  - Manrope para texto: legible y con personalidad propia.
*/
const display = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

const sans = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Metamorfosis — 7ma Edición (Sept/Oct 2026)',
  description:
    'Taller de Inteligencia Emocional en Zona Oeste. Fase 1: un fin de semana intensivo para entender tu historia y transformarla. Cupos limitados — inscribite por WhatsApp.',
  icons: {
    icon: 'https://pub-a6844436cdf343eca77a9769bb10e73e.r2.dev/favicon.ico',
    shortcut: 'https://pub-a6844436cdf343eca77a9769bb10e73e.r2.dev/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
