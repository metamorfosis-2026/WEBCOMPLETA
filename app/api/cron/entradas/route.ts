import { NextResponse, type NextRequest } from 'next/server';

import { runDailyReminders } from '@/app/lib/entradas-flow';
import { getSiteUrl } from '@/app/lib/site';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/*
  Recordatorios diarios por WhatsApp (lo dispara Vercel Cron, ver vercel.json).
  Vercel manda "Authorization: Bearer CRON_SECRET" si esa variable existe.
*/
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const summary = await runDailyReminders(getSiteUrl(request.nextUrl.origin));
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error('[cron] recordatorios de entradas:', error);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
