'use client';

import { useEffect, useState } from 'react';

type NewsItem = {
  id: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  isPinned: boolean;
};

const STORAGE_KEY = 'metamorfosis:dismissed-news';

function readDismissed(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function NewsBanner({ posts }: { posts: NewsItem[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const visible = posts.filter((post) => post.isPinned || !dismissed.includes(post.id));

  if (!visible.length) return null;

  return (
    <section aria-label="Noticias" className="mb-6 grid gap-3">
      {visible.map((post) => (
        <article
          key={post.id}
          className="relative overflow-hidden rounded-3xl border border-emerald-300/30 bg-gradient-to-br from-emerald-400/15 via-cyan-300/10 to-slate-950 p-5 shadow-[0_18px_50px_rgba(16,185,129,0.18)] sm:p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {post.imageUrl ? (
              <img
                src={post.imageUrl}
                alt=""
                className="h-24 w-24 flex-none rounded-2xl border border-white/10 object-cover"
              />
            ) : null}
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-100/90">
                {post.isPinned ? 'Aviso fijado' : 'Aviso del taller'}
              </p>
              <h3 className="mt-2 text-base font-semibold text-white sm:text-lg">{post.title}</h3>
              {post.body ? (
                <p className="mt-2 text-sm leading-6 text-white/80">{post.body}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {post.ctaUrl ? (
                  <a
                    href={post.ctaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-emerald-300/40 bg-emerald-400/15 px-3 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/25"
                  >
                    {post.ctaLabel ?? 'Ver mas'}
                  </a>
                ) : null}
                {!post.isPinned ? (
                  <button
                    type="button"
                    onClick={() => {
                      const next = Array.from(new Set([...dismissed, post.id]));
                      setDismissed(next);
                      try {
                        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                      } catch {
                        // ignore storage errors
                      }
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/70 transition hover:bg-white/10"
                  >
                    Marcar como leido
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
