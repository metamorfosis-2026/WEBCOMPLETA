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
  title: 'Metamorfosis — 7ma Edición · 28 y 29 de noviembre',
  description:
    'Taller de Inteligencia Emocional en Zona Oeste. Fase 1: sábado 28 y domingo 29 de noviembre, un fin de semana intensivo para entender tu historia y transformarla. Entradas con Mercado Pago, hasta 50 lugares.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
