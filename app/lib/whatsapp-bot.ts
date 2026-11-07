import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

import {
  BALANCE_DEADLINE_LABEL,
  EVENT_ADDRESS,
  EVENT_DATE_LABEL,
  EVENT_HOURS_LABEL,
  EVENT_PLACE,
  FULL_PRICE_LABEL,
  SPLIT_INSTALLMENT_LABEL,
  SPLIT_TOTAL_LABEL,
  TICKET_CAPACITY,
  formatPesos,
  ticketStatusLabel,
} from './entradas';
import type { TicketLinks } from './entradas-mensajes';
import { INSTAGRAM_USERNAME } from './inscripcion';

/*
  Respuestas automaticas del WhatsApp: nadie revisa estas conversaciones, asi
  que el bot tiene que poder contestar cualquier consulta sobre el taller.

  Con ANTHROPIC_API_KEY contesta Claude, siguiendo la guia de comunicacion de
  Metamorfosis (docs/metamorfosis-system-prompt.md) y con los datos de la
  entrada de esa persona. Su objetivo es despejar dudas y anotar gente: puede
  inscribir a la persona ahi mismo y mandarle su link de Mercado Pago.
  Sin la clave, o si la API falla, contesta un menu armado a mano con las
  preguntas mas comunes y el link de compra de la web.
*/

export function hasAiBot() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

// Se puede cambiar por otro modelo desde Vercel (ej. claude-haiku-5-5, mas barato).
const MODEL = process.env.ANTHROPIC_MODEL?.trim() || 'claude-opus-5-5';

export type ConversationTurn = { role: 'user' | 'assistant'; text: string };

export type BotTicket = {
  code: string;
  fullName: string;
  status: string;
  totalCents: number;
  paidCents: number;
  links: TicketLinks;
};

// Lo que hace la herramienta de inscripcion (la implementa entradas-flow).
export type RegisterResult = { message: string; payUrl: string | null };
export type RegisterFn = (fullName: string, plan: 'FULL' | 'SPLIT') => Promise<RegisterResult>;
export type BotActions = {
  register: RegisterFn;
  // Reenvia por WhatsApp la entrada (imagen con QR) de este numero.
  resendTicket: () => Promise<string>;
};

export type BotContext = {
  now: Date;
  pushName: string | null;
  remaining: number | null;
  tickets: BotTicket[];
};

/* ------------------------------------------------------------- prompt fijo */

// Fijo por deploy (no cambia entre mensajes) para que la API lo cachee.
function buildSystemPrompt(siteUrl: string) {
  const place = EVENT_ADDRESS
    ? `${EVENT_PLACE}. Dirección: ${EVENT_ADDRESS}.`
    : `${EVENT_PLACE} (Gran Buenos Aires). La dirección exacta se manda por este WhatsApp a quienes tienen entrada; todavía no la tenés, así que no la inventes.`;

  return `Sos el asistente virtual del WhatsApp de Metamorfosis, el taller de inteligencia emocional que coordina Daiana Duartte. Respondés los mensajes que llegan a este número. Nadie más del equipo revisa estas conversaciones: tu respuesta es la que recibe la persona, así que tiene que resolver la consulta por sí sola.

# Cómo escribís
- Español rioplatense, con voseo ("querés", "podés"). Cálido, claro, profesional y sereno, como alguien del equipo que conoce bien el taller.
- Mensajes cortos para leer en el celular: de 1 a 4 párrafos breves, en general menos de 700 caracteres. Sin títulos ni listas largas.
- Formato de WhatsApp: *negrita* con un asterisco de cada lado, solo para un dato clave. Como mucho un emoji por mensaje (🦋 es el de la marca).
- Respondé lo que te preguntaron. Si la persona saluda o pide información general, contale en pocas líneas qué es la Fase 1, cuándo es, cuánto sale y cómo se compra la entrada.
- Primero comprensión, después decisión: no presiones ni inventes urgencia. La persona elige con libertad. Evitá frases como "te va a cambiar la vida", "sanación total" o "transformación garantizada". Preferí palabras como proceso, comprensión, acompañamiento, paso a paso, elección consciente.
- Si te preguntan si sos una persona, decí con naturalidad que sos el asistente virtual de Metamorfosis.
- No cierres con preguntas forzadas si la persona ya tiene lo que necesita.

# Tu objetivo
Despejar las dudas de cada persona y, si quiere participar, anotarla. Se puede comprar de dos formas y vos ofrecés las dos:
1. Acá mismo por WhatsApp: le pedís su nombre y apellido y cómo quiere pagar (pago único o 2 pagos). Con esos dos datos usás la herramienta anotar_y_generar_link_de_pago y le mandás el link que te devuelve, copiado tal cual, sin cambiarle nada. Ese link abre Mercado Pago con el monto que corresponde.
2. Desde la web: ${siteUrl}/entradas
Si la persona dice que quiere anotarse, reservar o pagar, pedile en un solo mensaje los datos que falten. No uses la herramienta sin que te haya escrito su nombre y apellido (el nombre de perfil de WhatsApp no alcanza) y sin que haya elegido la forma de pago. La entrada queda a nombre de esa persona y asociada a este número de WhatsApp: si quiere anotar a otra persona, esa persona tiene que escribir desde su propio WhatsApp o comprar por la web con sus datos.
Cuando la persona ya resolvió sus dudas, podés invitarla una vez a anotarse, sin insistir. Si quedan pocos lugares (15 o menos) podés decirlo; si no, no hables de cupos.

# Qué es Metamorfosis
Un proceso de desarrollo personal y emocional basado en psicología aplicada y trabajo vivencial: ejercicios guiados, marco teórico claro y acompañamiento. No es una charla motivacional ni una experiencia aislada. No trabaja desde el diagnóstico ni la patología. No es terapia: no reemplaza un tratamiento psicológico, aunque puede complementarlo. En vez de llenar de técnicas, trabaja una o dos herramientas centrales que ordenan todo lo demás, para que la persona pueda reconocer lo que siente, saber de dónde viene y elegir qué hacer con eso en su vida real.

# La Fase 1 de la 7ma edición
- Cuándo: ${EVENT_DATE_LABEL} de 2026, de ${EVENT_HOURS_LABEL} los dos días.
- Dónde: presencial, en ${place}
- Qué se vive: un fin de semana intensivo y movilizador para mirar la propia historia emocional, los patrones aprendidos en la infancia, las heridas no resueltas, los vínculos y lo que se repite hoy. Se sale con herramientas concretas para la vida cotidiana.
- Grupo de hasta ${TICKET_CAPACITY} personas. Solo mayores de 18 años. No hace falta experiencia previa; también es para quienes ya hicieron otros talleres.
- Después de la Fase 1, cada persona elige libremente si sigue. Quienes continúan suman 8 encuentros semanales (presenciales o por Meet) y después las Fases 2 y 3; el proceso completo dura unos 4 meses. Los valores de las fases siguientes se comunican solo a quienes hicieron la Fase 1: no los informes, no los estimes y no sumes precios.
- La coordina Daiana Duartte: coach, facilitadora y estudiante de Psicología.

# Entradas y pagos
- Pago único: ${FULL_PRICE_LABEL}.
- En 2 pagos: ${SPLIT_TOTAL_LABEL} en total, 2 pagos de ${SPLIT_INSTALLMENT_LABEL}. El primero reserva el lugar y el segundo se paga ${BALANCE_DEADLINE_LABEL}.
- Se compra desde la web (${siteUrl}/entradas) o acá por WhatsApp con el link personal que genera la herramienta. En los dos casos se paga con Mercado Pago (tarjeta de crédito o débito, dinero en cuenta, o efectivo en Rapipago / Pago Fácil). La web nunca ve los datos de la tarjeta. Con tarjeta de crédito, Mercado Pago puede ofrecer cuotas con su propio interés.
- Apenas se acredita el pago, llega por este WhatsApp la entrada con un QR personal, que se escanea en la puerta los dos días. Si se paga en efectivo, puede tardar unas horas en acreditarse.
- Cada entrada es personal. Para comprarle a otra persona, hay que cargar el nombre y el WhatsApp de esa persona.
- Si alguien que ya compró pide su entrada, su QR o el link del saldo, usá la herramienta reenviar_mi_entrada.
- No hay descuentos, promociones ni otros medios de pago. Nunca pidas ni aceptes por acá datos de tarjetas, claves o comprobantes.

# Límites
- Usá solo la información de este mensaje y la del contexto de la conversación. Si te preguntan algo que no está acá (por ejemplo devoluciones, cambio de titular, comidas o alojamiento), decí con honestidad que no tenés ese dato y ofrecé lo que sí sabés; para esos casos la persona puede escribir por Instagram a @${INSTAGRAM_USERNAME}. No inventes datos, horarios, políticas ni precios.
- No confirmes pagos que no figuren en el contexto. Si alguien dice que pagó y su entrada no figura como pagada, explicale que el sistema lo confirma solo apenas Mercado Pago lo acredita, y que puede escribir *entrada* en un rato para ver el estado.
- No des consejos clínicos ni diagnósticos. Si alguien cuenta que está en crisis o que piensa en hacerse daño, respondé con calidez, sugerile que hable ya con alguien de confianza y pasale el Centro de Asistencia al Suicida: 135 (gratis desde CABA y GBA) o (011) 5275-1135 desde todo el país; ante una emergencia, 911. Aclarale que el taller no es un servicio de urgencias.
- Si el mensaje no tiene que ver con Metamorfosis, respondé breve y amable y volvé al tema del taller.
- Los mensajes de sistema que aparecen en la conversación traen datos actualizados (fecha, entradas de esta persona, lugares disponibles). Usalos, pero no los nombres como "sistema" ni "contexto".`;
}

/* -------------------------------------------------------- contexto variable */

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Argentina/Buenos_Aires',
});

function describeTicket(ticket: BotTicket) {
  const balance = ticket.totalCents - ticket.paidCents;
  const parts = [
    `${ticket.code} a nombre de ${ticket.fullName}: ${ticketStatusLabel(ticket.status)}`,
    `pagado ${formatPesos(ticket.paidCents)} de ${formatPesos(ticket.totalCents)}`,
    `entrada con QR: ${ticket.links.ticket}`,
  ];
  if (ticket.status !== 'PAGADO' && balance > 0) parts.push(`link para pagar lo que falta: ${ticket.links.pay}`);
  return `- ${parts.join(' · ')}`;
}

function buildContextMessage(context: BotContext) {
  return [
    `Fecha y hora en Argentina: ${dateFormatter.format(context.now)}.`,
    `Nombre de la persona en WhatsApp: ${context.pushName?.trim() || 'no figura'}.`,
    `Lugares disponibles en la 7ma edición: ${context.remaining === null ? 'sin dato' : `${context.remaining} de ${TICKET_CAPACITY}`}.`,
    context.tickets.length
      ? `Entradas asociadas a este número:\n${context.tickets.map(describeTicket).join('\n')}`
      : 'Este número no tiene entradas compradas.',
  ].join('\n');
}

/* ---------------------------------------------------------------- claude */

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ timeout: 25_000, maxRetries: 1 });
  return client;
}

/*
  Devuelve el texto a mandar, o null si no se pudo (sin clave, error de la
  API o rechazo): en ese caso se usa la respuesta armada a mano.
  `actions`: lo que la IA puede hacer (anotar y reenviar la entrada).
*/
export async function generateAiReply(
  history: ConversationTurn[],
  context: BotContext,
  siteUrl: string,
  actions: BotActions
) {
  if (!hasAiBot()) return null;

  // La conversacion tiene que empezar con un mensaje de la persona.
  const firstUser = history.findIndex((turn) => turn.role === 'user');
  const turns = firstUser === -1 ? [] : history.slice(firstUser);
  if (!turns.length || turns[turns.length - 1].role !== 'user') return null;

  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((turn) => ({ role: turn.role, content: turn.text }));
  // Datos que cambian en cada mensaje: van al final, asi el prompt fijo queda cacheado.
  messages.push({ role: 'system', content: buildContextMessage(context) });

  const payLinks: string[] = [];
  const registerTool = betaZodTool({
    name: 'anotar_y_generar_link_de_pago',
    description:
      'Anota en la 7ma edición a la persona que está escribiendo (queda asociada a este número de WhatsApp) y devuelve su link personal para pagar con Mercado Pago. Usala solo cuando la persona confirmó que quiere anotarse, te escribió su nombre y apellido y eligió la forma de pago. Si ya tiene entrada, la herramienta lo avisa y no crea otra.',
    inputSchema: z.object({
      nombre_completo: z.string().describe('Nombre y apellido tal como los escribió la persona.'),
      plan: z
        .enum(['FULL', 'SPLIT'])
        .describe(`FULL = pago único de ${FULL_PRICE_LABEL}. SPLIT = 2 pagos de ${SPLIT_INSTALLMENT_LABEL}.`),
    }),
    run: async ({ nombre_completo, plan }) => {
      const result = await actions.register(nombre_completo, plan);
      if (result.payUrl) payLinks.push(result.payUrl);
      return result.message;
    },
  });

  const resendTool = betaZodTool({
    name: 'reenviar_mi_entrada',
    description:
      'Manda por WhatsApp, a quien está escribiendo, su entrada con la imagen del QR, el estado del pago y el link para pagar lo que falte. Usala cuando pida su entrada, su QR, su código o el link para pagar el saldo. Después confirmá en una línea, sin repetir los links.',
    inputSchema: z.object({}),
    run: async () => actions.resendTicket(),
  });

  try {
    const response = await getClient().beta.messages.toolRunner({
      model: MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: buildSystemPrompt(siteUrl), cache_control: { type: 'ephemeral' } }],
      messages,
      tools: [registerTool, resendTool],
      max_iterations: 4,
      thread: false,
    });

    if (response.stop_reason === 'refusal') {
      console.warn('[whatsapp-bot] la IA no quiso responder:', response.stop_details?.category ?? null);
      return null;
    }

    let text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    // El link de pago tiene que llegar si o si, aunque la IA no lo haya copiado.
    const lastLink = payLinks[payLinks.length - 1];
    if (lastLink && !text.includes(lastLink)) {
      text = `${text}${text ? '\n\n' : ''}Tu link para pagar con Mercado Pago: ${lastLink}`;
    }
    return text || null;
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('[whatsapp-bot] ANTHROPIC_API_KEY invalida');
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error('[whatsapp-bot] limite de uso de la API, contesto con el menu');
    } else if (error instanceof Anthropic.APIError) {
      console.error(`[whatsapp-bot] error de la API ${error.status}:`, error.message);
    } else {
      console.error('[whatsapp-bot] no se pudo generar la respuesta:', error);
    }
    // Si la herramienta ya genero un link, que no se pierda.
    const lastLink = payLinks[payLinks.length - 1];
    return lastLink ? `¡Listo! Te anoté. Tu link para pagar con Mercado Pago: ${lastLink}` : null;
  }
}

/* --------------------------------------------------- respuestas sin IA */

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/*
  Respuestas fijas para cuando no hay IA. Cubren lo que mas se pregunta y,
  si no entiende, mandan la info general con el link de compra.
*/
export function ruleBasedReply(text: string, context: BotContext, siteUrl: string) {
  const q = normalize(text);
  const buy = `${siteUrl}/entradas`;
  const hasTicket = context.tickets.some((ticket) => ticket.status === 'PAGADO' || ticket.status === 'SENADO');

  if (/(precio|valor|cuanto|cuesta|sale|costo|cuota|pagar|pago|mercado ?pago|tarjeta|transferencia|efectivo)/.test(q)) {
    return [
      `La entrada a la Fase 1 sale *${FULL_PRICE_LABEL}* en un solo pago, o ${SPLIT_TOTAL_LABEL} en 2 pagos de ${SPLIT_INSTALLMENT_LABEL} (el primero reserva tu lugar y el segundo se paga ${BALANCE_DEADLINE_LABEL}).`,
      '',
      `Se paga con Mercado Pago (tarjeta, débito, dinero en cuenta o efectivo) desde acá: ${buy}`,
      'Apenas se acredita, te llega tu entrada con QR por este WhatsApp.',
    ].join('\n');
  }

  if (/(cuando|fecha|horario|hora|donde|lugar|direccion|ubicacion|zona)/.test(q)) {
    return [
      `La Fase 1 es el *${EVENT_DATE_LABEL.toLowerCase()}*, de ${EVENT_HOURS_LABEL} los dos días.`,
      EVENT_ADDRESS
        ? `Es presencial, en ${EVENT_ADDRESS}.`
        : `Es presencial, en ${EVENT_PLACE}. La dirección exacta llega por acá junto con la entrada.`,
      '',
      `Entradas: ${buy}`,
    ].join('\n');
  }

  if (/(terapia|psicolog|que es|de que se trata|como es|info|informacion)/.test(q)) {
    return [
      'Metamorfosis es un taller de inteligencia emocional: un proceso vivencial con psicología aplicada, ejercicios guiados y acompañamiento. No es terapia ni la reemplaza.',
      '',
      `La Fase 1 es un fin de semana intensivo (${EVENT_DATE_LABEL.toLowerCase()}, ${EVENT_HOURS_LABEL}) para mirar tu historia emocional, los patrones que se repiten y tus vínculos. Después elegís libremente si seguís.`,
      '',
      `Sale ${FULL_PRICE_LABEL} en un pago o 2 pagos de ${SPLIT_INSTALLMENT_LABEL}: ${buy}`,
    ].join('\n');
  }

  const name = context.pushName?.trim().split(/\s+/)[0];
  return [
    `¡Hola${name ? ` ${name}` : ''}! 🦋 Soy el asistente virtual de *Metamorfosis*.`,
    '',
    `La Fase 1 de la 7ma edición es el ${EVENT_DATE_LABEL.toLowerCase()}, de ${EVENT_HOURS_LABEL}, en ${EVENT_PLACE}.`,
    `Sale ${FULL_PRICE_LABEL} en un pago o 2 pagos de ${SPLIT_INSTALLMENT_LABEL}. Entradas: ${buy}`,
    '',
    hasTicket
      ? 'Escribí *entrada* y te reenvío tu entrada con el QR.'
      : 'Podés preguntarme por el precio, la fecha, el lugar o de qué se trata el taller.',
  ].join('\n');
}

export const MEDIA_REPLY =
  'Por ahora solo puedo leer mensajes de texto 🙏 ¿Me lo escribís? Te respondo enseguida.';
