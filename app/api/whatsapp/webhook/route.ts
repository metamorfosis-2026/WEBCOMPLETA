import { createHmac, timingSafeEqual } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';

import { handleIncomingWhatsApp, type IncomingWhatsApp } from '@/app/lib/entradas-flow';
import { toWhatsAppNumber } from '@/app/lib/phone';
import { getSiteUrl } from '@/app/lib/site';
import { insertWhatsAppMessage, listTicketsByPhone } from '@/app/lib/supabase/tickets';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/*
  Mensajes que llegan al WhatsApp Business. Sirve para los dos proveedores:
  - Cloud API (Meta): GET de verificacion con WHATSAPP_VERIFY_TOKEN y POST
    firmado con WHATSAPP_APP_SECRET (X-Hub-Signature-256).
  - Evolution API: POST con el evento messages.upsert. Se protege con
    ?token=WHATSAPP_VERIFY_TOKEN en la URL del webhook.
  El bot contesta todos los mensajes de personas (ver handleIncomingWhatsApp).
  Se ignoran grupos, estados, mensajes propios y mensajes de mas de 10
  minutos (al conectar el WhatsApp llegan mensajes viejos que no hay que
  contestar).
*/

const MAX_AGE_SECONDS = 10 * 60;

function isFresh(timestampSeconds: unknown) {
  const ts = Number(timestampSeconds);
  if (!Number.isFinite(ts) || ts <= 0) return true;
  return Date.now() / 1000 - ts <= MAX_AGE_SECONDS;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (params.get('hub.mode') === 'subscribe' && verifyToken && params.get('hub.verify_token') === verifyToken) {
    return new Response(params.get('hub.challenge') ?? '', { status: 200 });
  }
  return NextResponse.json({ ok: true });
}


function verifyMetaSignature(raw: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secret) return true;
  if (!header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  const received = Buffer.from(header.slice(7), 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function cloudMessages(body: any): { messages: IncomingWhatsApp[]; failures: { phone: string; error: string }[] } {
  const messages: IncomingWhatsApp[] = [];
  const failures: { phone: string; error: string }[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};
      const names = new Map<string, string>(
        (value.contacts ?? []).map((contact: any) => [String(contact?.wa_id ?? ''), String(contact?.profile?.name ?? '')])
      );
      for (const message of value.messages ?? []) {
        if (!message?.from || !isFresh(message?.timestamp)) continue;
        const text =
          message?.text?.body ??
          message?.button?.text ??
          message?.interactive?.button_reply?.title ??
          message?.interactive?.list_reply?.title ??
          message?.image?.caption ??
          message?.video?.caption ??
          '';
        const isMedia = ['audio', 'image', 'video', 'document'].includes(message?.type);
        if (!text && !isMedia) continue; // stickers, reacciones, etc.
        messages.push({
          from: String(message.from),
          text: String(text),
          messageId: message?.id ? String(message.id) : null,
          pushName: names.get(String(message.from)) || null,
          type: text ? 'text' : 'media',
          provider: 'cloud',
        });
      }
      // Cloud API acepta el envio y avisa despues si fallo (ej. fuera de la
      // ventana de 24 h sin plantilla): lo dejamos registrado para el admin.
      for (const status of value.statuses ?? []) {
        if (status?.status === 'failed' && status?.recipient_id) {
          const error = status?.errors?.[0];
          failures.push({
            phone: String(status.recipient_id),
            error: `${error?.code ?? ''} ${error?.title ?? error?.message ?? 'fallo la entrega'}`.trim(),
          });
        }
      }
    }
  }
  return { messages, failures };
}

function evolutionText(message: any) {
  const content = message?.message ?? {};
  return (
    content.conversation ??
    content.extendedTextMessage?.text ??
    content.imageMessage?.caption ??
    content.buttonsResponseMessage?.selectedDisplayText ??
    content.listResponseMessage?.title ??
    ''
  );
}

function evolutionMessages(body: any): IncomingWhatsApp[] {
  const event = String(body?.event ?? '').toLowerCase().replace(/_/g, '.');
  if (event !== 'messages.upsert') return [];

  const items = Array.isArray(body?.data) ? body.data : [body?.data];
  const messages: IncomingWhatsApp[] = [];
  for (const item of items) {
    const key = item?.key ?? {};
    if (key.fromMe || !isFresh(item?.messageTimestamp)) continue;
    // Con las direcciones nuevas de WhatsApp (@lid) el numero viene aparte.
    const jid = [key.remoteJid, key.remoteJidAlt, key.senderPn, item?.senderPn].find(
      (value) => typeof value === 'string' && /@s\.whatsapp\.net$/.test(value)
    );
    if (!jid) continue; // grupos, estados, o sin numero
    const text = String(evolutionText(item) ?? '');
    const content = item?.message ?? {};
    const isMedia = Boolean(
      content.audioMessage || content.pttMessage || content.imageMessage || content.videoMessage || content.documentMessage
    );
    if (!text && !isMedia) continue; // stickers, reacciones, mensajes de sistema
    messages.push({
      from: jid.split('@')[0],
      text,
      messageId: key.id ? String(key.id) : null,
      pushName: item?.pushName ? String(item.pushName) : null,
      type: text ? 'text' : 'media',
      provider: 'evolution',
    });
  }
  return messages;
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  let body: any = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ignored: true });
  }

  const siteUrl = getSiteUrl(request.nextUrl.origin);
  let incoming: IncomingWhatsApp[] = [];

  if (body?.object === 'whatsapp_business_account') {
    if (!verifyMetaSignature(raw, request.headers.get('x-hub-signature-256'))) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }
    const parsed = cloudMessages(body);
    incoming = parsed.messages;
    for (const failure of parsed.failures) {
      try {
        const phone = toWhatsAppNumber(failure.phone);
        const [ticket] = await listTicketsByPhone(phone);
        await insertWhatsAppMessage({
          ticket_id: ticket?.id ?? null,
          direction: 'OUT',
          phone,
          kind: 'FALLO',
          body: null,
          provider: 'cloud',
          ok: false,
          error: failure.error.slice(0, 500),
        });
      } catch (error) {
        console.error('[whatsapp] no se pudo registrar el fallo de entrega:', error);
      }
    }
  } else {
    const token = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
    if (token && request.nextUrl.searchParams.get('token') !== token) {
      return NextResponse.json({ error: 'invalid token' }, { status: 401 });
    }
    incoming = evolutionMessages(body);
  }

  // En paralelo: cada mensaje espera unos segundos por si la persona sigue escribiendo.
  await Promise.all(
    incoming.map(async (message) => {
      try {
        await handleIncomingWhatsApp(message, siteUrl);
      } catch (error) {
        console.error('[whatsapp] error respondiendo a', message.from, error);
      }
    })
  );

  // Siempre 200: si devolvemos error, Meta / Evolution reintentan sin parar.
  return NextResponse.json({ ok: true, received: incoming.length });
}
