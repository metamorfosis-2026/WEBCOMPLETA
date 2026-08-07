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
    <section aria-label="Noticias" className="grid gap-3">
      {visible.map((post) => (
        <article key={post.id} className="surface surface-accent overflow-hidden p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {post.imageUrl ? (
              <img
                src={post.imageUrl}
                alt=""
                className="h-24 w-24 flex-none rounded-2xl border border-ivory/10 object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <span className="chip chip-celeste">
                {post.isPinned ? 'Aviso fijado' : 'Aviso del taller'}
              </span>
              <h3 className="display mt-3 text-[1.35rem] leading-tight text-ivory">{post.title}</h3>
              {post.body ? (
                <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-ivory/70">{post.body}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {post.ctaUrl ? (
                  <a
                    href={post.ctaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-celeste px-4 text-xs font-extrabold uppercase tracking-[0.12em] text-night transition duration-300 hover:shadow-[0_14px_36px_-14px_rgba(124,201,236,1)]"
                  >
                    {post.ctaLabel ?? 'Ver más'}
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
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-ivory/12 bg-ivory/[0.05] px-4 text-xs font-bold uppercase tracking-[0.12em] text-ivory/60 transition duration-300 hover:border-ivory/30 hover:text-ivory"
                  >
                    Marcar como leído
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
