'use client';

import { useState } from 'react';

/*
  El link se guarda relativo (/register?ref=...) porque el dominio lo define
  el deploy. Al copiar lo completamos con el origin real para que sirva
  pegado en cualquier chat.
*/
export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const absolute =
      typeof window === 'undefined' ? path : new URL(path, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      // Sin permiso de portapapeles el link sigue visible y seleccionable.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-10 items-center justify-center rounded-xl border border-celeste/35 bg-celeste/12 px-4 text-xs font-bold uppercase tracking-[0.12em] text-celeste transition duration-300 hover:bg-celeste/20"
    >
      {copied ? 'Copiado ✓' : 'Copiar link'}
    </button>
  );
}
