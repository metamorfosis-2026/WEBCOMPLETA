import { ImageResponse } from 'next/og';
import QRCode from 'qrcode';

import { EVENT_DATE_LABEL, EVENT_HOURS_LABEL, EVENT_PLACE, formatPesos } from './entradas';

/*
  Imagen de la entrada (PNG 1080x1350) con el QR: es la que se manda por
  WhatsApp y la que se descarga desde la pagina de la entrada.
  El QR abre /entradas/CODIGO: en la puerta, con la sesion de admin, esa
  pagina muestra el boton para registrar el ingreso.
*/
export async function renderTicketImage(
  ticket: { code: string; fullName: string; status: string; totalCents: number; paidCents: number },
  siteUrl: string
) {
  const qr = await QRCode.toDataURL(`${siteUrl}/entradas/${ticket.code}`, {
    width: 600,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#04070E', light: '#FFFFFF' },
  });

  const paid = ticket.status === 'PAGADO';
  const balance = ticket.totalCents - ticket.paidCents;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '72px 80px',
          color: '#E9F1F7',
          backgroundColor: '#04070E',
          backgroundImage:
            'radial-gradient(circle at 20% 0%, rgba(124,201,236,0.28), transparent 55%), radial-gradient(circle at 100% 100%, rgba(62,159,203,0.22), transparent 50%)',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, letterSpacing: 14, color: '#7CC9EC' }}>METAMORFOSIS</div>
        <div style={{ display: 'flex', marginTop: 14, fontSize: 26, letterSpacing: 6, color: 'rgba(233,241,247,0.6)' }}>
          7MA EDICIÓN · FASE 1
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 56,
            fontSize: ticket.fullName.length > 22 ? 58 : 72,
            textAlign: 'center',
            lineHeight: 1.1,
          }}
        >
          {ticket.fullName}
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 52,
            padding: 28,
            borderRadius: 36,
            backgroundColor: '#FFFFFF',
            boxShadow: '0 30px 80px rgba(124,201,236,0.35)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={520} height={520} alt="" />
        </div>

        <div style={{ display: 'flex', marginTop: 36, fontSize: 44, letterSpacing: 8 }}>{ticket.code}</div>

        <div
          style={{
            display: 'flex',
            marginTop: 28,
            padding: '14px 30px',
            borderRadius: 999,
            fontSize: 26,
            letterSpacing: 3,
            color: '#04070E',
            backgroundColor: paid ? '#7CC9EC' : '#E4C89C',
          }}
        >
          {paid ? 'ENTRADA CONFIRMADA' : `LUGAR RESERVADO · SALDO ${formatPesos(balance)}`}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto' }}>
          <div style={{ display: 'flex', fontSize: 30 }}>{EVENT_DATE_LABEL}</div>
          <div style={{ display: 'flex', marginTop: 10, fontSize: 26, color: 'rgba(233,241,247,0.6)' }}>
            {`${EVENT_HOURS_LABEL} · ${EVENT_PLACE}`}
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      headers: { 'Cache-Control': 'public, max-age=60' },
    }
  );
}
