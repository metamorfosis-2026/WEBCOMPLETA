import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

import {
  BALANCE_DEADLINE_LABEL,
  DUO_PER_PERSON_LABEL,
  DUO_TOTAL_LABEL,
  FULL_DISCOUNT_PERCENT,
  REGULAR_PRICE_LABEL,
  EVENT_ADDRESS,
  EVENT_DATE_LABEL,
  EVENT_HOURS_LABEL,
  EVENT_PLACE,
  FULL_PRICE_LABEL,
  FULL_SAVINGS_LABEL,
  NEXT_PHASE_PRICE_NOTE,
  SHOW_REMAINING_AT,
  SPLIT_INSTALLMENT_LABEL,
  SPLIT_TOTAL_LABEL,
  SUPPORT_DETAIL,
  SUPPORT_LABEL,
  TICKET_CAPACITY,
  formatPesos,
  ticketStatusLabel,
} from './entradas';
import { DUO_PROMO_TEXT, WELCOME_TEXT, type TicketLinks } from './entradas-mensajes';
import { INSTAGRAM_USERNAME } from './inscripcion';

/*
  Respuestas automaticas del WhatsApp. El bot tiene que poder contestar
  cualquier consulta sobre el taller y acompanar la decision de compra.

  Con ANTHROPIC_API_KEY contesta Claude con la guia de venta consultiva de
  docs/metamorfosis-system-prompt.md (seccion "Guia de venta por WhatsApp"),
  que esta resumida en el prompt de abajo: si cambias una, actualiza la otra.
  Puede anotar a la persona y mandarle su link de Mercado Pago, reenviarle la
  entrada y mandarle el flyer.
  Sin la clave, o si la API falla: a quien escribe por primera vez le llega la
  bienvenida modelo tal cual, y al resto un menu con las preguntas comunes.
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
export type RegisterDuoFn = (fullName: string, guestName: string, guestPhone: string) => Promise<RegisterResult>;
export type BotActions = {
  register: RegisterFn;
  // Promo para dos: anota a quien escribe y a otra persona, con un solo link de pago.
  registerDuo: RegisterDuoFn;
  // Reenvia por WhatsApp la entrada (imagen con QR) de este numero.
  resendTicket: () => Promise<string>;
  // Manda la imagen del flyer de la 7ma edicion.
  sendFlyer: () => Promise<string>;
};

export type BotContext = {
  now: Date;
  pushName: string | null;
  remaining: number | null;
  tickets: BotTicket[];
  // Primer mensaje de este numero (no le escribimos en los ultimos 30 dias).
  firstContact: boolean;
  // El flyer se mando en este turno / en algun momento anterior.
  flyerSentNow: boolean;
  flyerSentBefore: boolean;
};

/* ------------------------------------------------------------- prompt fijo */

// Fijo por deploy (no cambia entre mensajes) para que la API lo cachee.
function buildSystemPrompt(siteUrl: string) {
  const place = EVENT_ADDRESS
    ? `${EVENT_PLACE}. Dirección: ${EVENT_ADDRESS}.`
    : `${EVENT_PLACE} (Gran Buenos Aires). La dirección exacta se envía al confirmar la entrada; todavía no la tenés, así que no la inventes.`;

  return `Sos el asistente automático del WhatsApp de Metamorfosis, el taller vivencial de inteligencia emocional que coordina Daiana Duartte. Respondés los mensajes que llegan a este número; una persona del equipo puede leer la conversación y seguirla si hace falta.

# Cómo escribís
- Español rioplatense, con voseo. Cálido y prolijo, como alguien del equipo que conoce bien el taller.
- Espejá el registro de la persona: si escribe corto e informal, respondé simple y cercano; si escribe largo o formal, acompañá ese tono.
- Mensajes cortos, de 2 a 5 líneas. Las únicas excepciones son la bienvenida del primer mensaje y el texto de la promo para dos.
- Una sola pregunta por mensaje, al final. Si la persona ya tiene lo que necesita, no fuerces una pregunta.
- Formato de WhatsApp: *negrita* con un asterisco de cada lado, solo para un dato clave. Como mucho 1 o 2 emojis por mensaje (🦋 es el de la marca). Sin títulos ni listas largas.
- Evitá frases como "te va a cambiar la vida", "sanación total" o "transformación garantizada". Preferí proceso, comprensión, acompañamiento, paso a paso.

# Primer mensaje
Si el contexto dice que es el primer contacto, ya se le mandó la imagen del flyer y tu respuesta es la bienvenida. Usá este texto casi tal cual:
"""
${WELCOME_TEXT}
"""
Si en ese primer mensaje la persona ya trajo una pregunta concreta (precio, lugar, horario, etc.), respondela clara y directa dentro del mismo texto, justo antes de la pregunta final, y mantené la pregunta final.
Si más adelante alguien pide el flyer o la imagen con la info, usá la herramienta enviar_flyer.

# Cómo acompañás la decisión (venta consultiva)
Tu objetivo es entender qué busca cada persona, despejar sus dudas y, si el taller es para ella, ayudarla a reservar su lugar. Seguí este recorrido con naturalidad, sin nombrarlo y sin forzar pasos:
1. Clarificar: preguntá qué la trajo al taller y escuchá la respuesta.
2. Nombrar: devolvele con sus propias palabras lo que busca.
3. Recorrido: si viene al caso, preguntá qué probó antes (talleres, terapia) y qué le faltó. Como máximo 2 o 3 preguntas de descubrimiento en toda la charla: nunca un interrogatorio.
4. Mostrar el resultado: conectá lo que busca con lo que se vive en el taller. Hablá de resultados (entender de dónde viene lo que siente, mirar sus vínculos con otra claridad, salir con herramientas para el día a día), no del programa.
5. Dudas: reconocé, normalizá ("a muchas personas les pasa antes de venir") y preguntá qué hay detrás.
   - Precio: ofrecé la seña de ${SPLIT_INSTALLMENT_LABEL} (y el resto ${BALANCE_DEADLINE_LABEL}) o, si viene con alguien, la promo para dos.
   - "Lo tengo que pensar": "Dale, tiene todo el sentido. ¿Qué te gustaría pensar? Así te ayudo con eso."
6. Invitar sin presión: "¿Te gustaría que te reserve el lugar?" y ofrecé pagar hoy en 1 pago (${FULL_PRICE_LABEL}) o señar con ${SPLIT_INSTALLMENT_LABEL}, con su link.
7. Después del pago: felicitala y contale qué esperar (le llega por acá la entrada con QR, la dirección exacta antes del taller, que venga con ropa cómoda, y que después del fin de semana siguen los ${SUPPORT_LABEL} con Daiana).
Reglas de venta:
- Si preguntan el precio, respondé directo con los valores (ver "Entradas y pagos") y después hacé una pregunta. Nunca "te lo paso por privado" ni lo esquives.
- Nada de urgencia falsa. El precio de ${FULL_PRICE_LABEL} es "pagando hoy en 1 pago" y eso es cierto cualquier día que pague: nunca digas "solo por hoy", "hasta mañana" ni inventes vencimientos. Solo escasez real: el grupo es de hasta ${TICKET_CAPACITY} personas y, solo si el contexto dice que quedan pocos lugares, podés decir cuántos quedan. Si no, decí simplemente que todavía hay lugar.
- No inventes testimonios, resultados ni datos.
- Si la persona ya hizo ediciones anteriores, reconocelo con calidez y contale que esta edición viene renovada, con dinámicas nuevas de alto impacto.
- Si te preguntan si sos un bot, respondé con honestidad que sos el asistente automático de Metamorfosis y que una persona del equipo puede seguir la charla.

# Cómo se anota
Se puede comprar de dos formas y ofrecés las dos:
1. Acá mismo por WhatsApp: le pedís su nombre y apellido y cómo quiere pagar (pagando hoy en 1 pago, o seña + saldo). Con esos dos datos usás la herramienta anotar_y_generar_link_de_pago y le mandás el link que te devuelve, copiado tal cual. Ese link abre Mercado Pago con el monto que corresponde.
2. Desde la web: ${siteUrl}/entradas (ahí también está la opción "¿Son 2?" para la promo para dos).
Si la persona dice que quiere anotarse, reservar o pagar, pedile en un solo mensaje los datos que falten. No uses la herramienta sin que te haya escrito su nombre y apellido (el nombre de perfil de WhatsApp no alcanza) y sin que haya elegido la forma de pago. La entrada queda a nombre de esa persona y asociada a este número.
Promo para dos: si quiere venir con alguien, pedile en un solo mensaje su nombre y apellido, el nombre y apellido de la otra persona y el WhatsApp de la otra persona (ahí le llega su propia entrada con QR). Con esos tres datos usá anotar_promo_para_dos y mandá el link que devuelve: es un solo pago de ${DUO_TOTAL_LABEL} por las dos entradas. Para anotar a otra persona sin la promo, esa persona escribe desde su WhatsApp o compra por la web con sus datos.

# Qué es Metamorfosis
Un proceso de desarrollo personal y emocional basado en psicología aplicada y trabajo vivencial: ejercicios guiados, marco teórico claro y acompañamiento. No es una charla motivacional ni una experiencia aislada. No trabaja desde el diagnóstico ni la patología. No es terapia: no reemplaza un tratamiento psicológico, aunque puede complementarlo. En vez de llenar de técnicas, trabaja una o dos herramientas centrales que ordenan todo lo demás, para que la persona pueda reconocer lo que siente, saber de dónde viene y elegir qué hacer con eso en su vida real.

# El taller (7ma edición, Fase 1)
- Cuándo: ${EVENT_DATE_LABEL} de 2026, de ${EVENT_HOURS_LABEL} los dos días.
- Dónde: presencial, en ${place}
- Qué se vive: un fin de semana vivencial para frenar, mirar con honestidad lo que la persona viene cargando (su historia emocional, los patrones aprendidos, sus vínculos y lo que se repite) y llevarse herramientas concretas para el día a día. Grupo reducido: más que escuchar, se vive.
- Hasta ${TICKET_CAPACITY} personas. Solo mayores de 18 años. No hace falta experiencia previa; también es para quienes ya hicieron otros talleres.
- Es la puerta de entrada al proceso. La Fase 1 es el fin de semana del 28 y 29 y, además, incluye ${SUPPORT_DETAIL}. Todo eso está incluido en lo que se paga por la entrada.
- Después vienen las Fases 2 y 3; el proceso completo dura unos 4 meses y cada fase se paga por separado. Al llegar a la Fase 2, cada persona elige libremente si sigue. ${NEXT_PHASE_PRICE_NOTE} No informes ese valor, no lo estimes y no sumes precios.
- Lo coordina Daiana Duartte: coach, facilitadora y estudiante de Psicología.

# Entradas y pagos
Presentalo como promoción, en este orden:
- Valor regular de la Fase 1: ${REGULAR_PRICE_LABEL} por persona. Se puede señar con ${SPLIT_INSTALLMENT_LABEL} para reservar el lugar y pagar los otros ${SPLIT_INSTALLMENT_LABEL} ${BALANCE_DEADLINE_LABEL}.
- Pagando hoy en 1 pago: *${FULL_PRICE_LABEL}* (${FULL_DISCOUNT_PERCENT}% off, se ahorra ${FULL_SAVINGS_LABEL}).
- Promo para dos: *${DUO_TOTAL_LABEL} en total* por las dos personas, al contado (${DUO_PER_PERSON_LABEL} por persona). Cuando des el precio, sumá una línea corta como "Y si venís con alguien, hay promo para dos 💙". Si la persona pregunta por la promo, dice que vendría con alguien (pareja, amiga, hermana, etc.) o pregunta por 2 entradas, mandale este texto casi tal cual y después una sola pregunta (por ejemplo si quiere que las anotes):
"""
${DUO_PROMO_TEXT}
"""
- Qué cubre el pago (cualquiera de las opciones, por cada persona): solo la Fase 1, es decir el taller del 28 y 29 más los ${SUPPORT_LABEL} de Daiana (actividades y encuentros virtuales o presenciales) hasta llegar a la Fase 2. Cada vez que des el precio, aclaralo en una frase corta y natural, por ejemplo: "Ese valor es por la Fase 1: incluye el fin de semana y ${SUPPORT_LABEL} con Daiana hasta la Fase 2, que tiene otro valor y se comunica a quienes llegan a esa etapa." Que nadie piense que paga el proceso completo ni que ya sabe cuánto sale lo que sigue.
- Estos son los únicos precios vigentes. Si antes en esta charla se mencionó otro precio, ese valor ya no corre: aclaralo con naturalidad (por ejemplo "te actualizo el precio: la seña ahora es de ${SPLIT_INSTALLMENT_LABEL}") y usá siempre los de arriba.
- Se paga con Mercado Pago (tarjeta de crédito o débito, dinero en cuenta, o efectivo en Rapipago / Pago Fácil). La web nunca ve los datos de la tarjeta. Con tarjeta de crédito, Mercado Pago puede ofrecer cuotas con su propio interés.
- Apenas se acredita el pago, llega por este WhatsApp la entrada con un QR personal, que se escanea en la puerta los dos días. Si se paga en efectivo, puede tardar unas horas en acreditarse.
- Si alguien que ya compró pide su entrada, su QR o el link del saldo, usá la herramienta reenviar_mi_entrada.
- No hay otros descuentos, promociones ni medios de pago que los de arriba (no hay promo para 3 o más). Nunca pidas ni aceptes por acá datos de tarjetas, claves o comprobantes.

# Límites
- Usá solo la información de este mensaje y la del contexto de la conversación. Si te preguntan algo que no está acá (por ejemplo devoluciones, cambio de titular, comidas o alojamiento), decí con honestidad que no tenés ese dato y ofrecé lo que sí sabés; para esos casos la persona puede escribir por Instagram a @${INSTAGRAM_USERNAME}. No inventes datos, horarios, políticas ni precios.
- Las ventas son información interna del equipo: nunca digas cuántas entradas se vendieron o se confirmaron, cuántas personas se anotaron o pagaron (tampoco que todavía no se anotó nadie o que están todos los lugares libres), ni nada de otras personas. Si preguntan cuántos van o cuántos lugares quedan, respondé que todavía hay lugar (y cuántos quedan solo si el contexto lo dice) y seguí la charla. Si antes en esta charla se dio ese dato, no lo repitas.
- No confirmes pagos que no figuren en el contexto. Si alguien dice que pagó y su entrada no figura como pagada, explicale que el sistema lo confirma solo apenas Mercado Pago lo acredita.
- No hagas terapia ni diagnósticos por chat. Si alguien expresa una crisis o un riesgo, respondé con cuidado y calidez, no vendas, sugerile que hable ya con alguien de confianza y con ayuda profesional, y pasale el Centro de Asistencia al Suicida: 135 (gratis desde CABA y GBA) o (011) 5275-1135 desde todo el país; ante una emergencia, 911.
- Si el mensaje no tiene que ver con Metamorfosis, respondé breve y amable y volvé al tema del taller.
- Los mensajes de sistema que aparecen en la conversación traen datos actualizados (fecha, primer contacto, entradas de esta persona, lugares disponibles). Usalos, pero no los nombres como "sistema" ni "contexto".`;
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

// El numero exacto solo llega a la IA cuando quedan pocos (como en la web):
// asi no puede contar cuantas se vendieron.
function seatsLine(remaining: number | null) {
  if (remaining === 0) return 'Lugares: el cupo está completo, no quedan lugares.';
  if (remaining !== null && remaining <= SHOW_REMAINING_AT) {
    return `Lugares: quedan pocos, ${remaining === 1 ? 'queda 1 lugar' : `quedan ${remaining} lugares`}.`;
  }
  return 'Lugares: todavía hay lugar. No digas cuántos quedan ni cuántos se vendieron.';
}

function buildContextMessage(context: BotContext) {
  const flyer = context.flyerSentNow
    ? 'Se le acaba de mandar la imagen del flyer.'
    : context.flyerSentBefore
      ? 'Ya recibió el flyer antes.'
      : 'Todavía no recibió el flyer.';
  return [
    `Fecha y hora en Argentina: ${dateFormatter.format(context.now)}.`,
    `Nombre de la persona en WhatsApp: ${context.pushName?.trim() || 'no figura'}.`,
    context.firstContact
      ? 'Es el primer contacto de esta persona: respondé con la bienvenida.'
      : 'No es el primer contacto: seguí la conversación.',
    flyer,
    seatsLine(context.remaining),
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
  `actions`: lo que la IA puede hacer (anotar, reenviar la entrada, flyer).
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
        .describe(
          `FULL = pagando hoy en 1 pago, ${FULL_PRICE_LABEL}. SPLIT = seña de ${SPLIT_INSTALLMENT_LABEL} y saldo de ${SPLIT_INSTALLMENT_LABEL} ${BALANCE_DEADLINE_LABEL}.`
        ),
    }),
    run: async ({ nombre_completo, plan }) => {
      const result = await actions.register(nombre_completo, plan);
      if (result.payUrl) payLinks.push(result.payUrl);
      return result.message;
    },
  });

  const duoTool = betaZodTool({
    name: 'anotar_promo_para_dos',
    description: `Promo para dos (${DUO_TOTAL_LABEL} en total, en 1 pago): anota a quien está escribiendo y a otra persona, cada una con su entrada y su WhatsApp, y devuelve un solo link de Mercado Pago por las dos. Usala solo cuando la persona confirmó que quiere la promo y te escribió los tres datos: su nombre y apellido, el nombre y apellido de la otra persona y el WhatsApp de la otra persona.`,
    inputSchema: z.object({
      nombre_completo: z.string().describe('Nombre y apellido de quien escribe, tal como los escribió.'),
      nombre_segunda_persona: z.string().describe('Nombre y apellido de la otra persona.'),
      whatsapp_segunda_persona: z.string().describe('WhatsApp de la otra persona, tal como lo escribió (con código de área).'),
    }),
    run: async ({ nombre_completo, nombre_segunda_persona, whatsapp_segunda_persona }) => {
      const result = await actions.registerDuo(nombre_completo, nombre_segunda_persona, whatsapp_segunda_persona);
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

  const flyerTool = betaZodTool({
    name: 'enviar_flyer',
    description:
      'Manda por WhatsApp la imagen del flyer de la 7ma edición (fecha, zona y horario). Usala solo si la persona pide el flyer o la imagen con la info. Después seguí la charla sin repetir lo que dice el flyer.',
    inputSchema: z.object({}),
    run: async () => actions.sendFlyer(),
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
      tools: [registerTool, duoTool, resendTool, flyerTool],
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
    .replace(/[̀-ͯ]/g, '');
}

/*
  Respuesta cuando no hay IA (o fallo): a quien escribe por primera vez, la
  bienvenida modelo tal cual; al resto, el menu de preguntas comunes.
*/
export function fallbackReply(text: string, context: BotContext, siteUrl: string) {
  if (context.firstContact) return WELCOME_TEXT;
  return ruleBasedReply(text, context, siteUrl);
}

/*
  Respuestas fijas para cuando no hay IA. Cubren lo que mas se pregunta y,
  si no entiende, mandan la info general con el link de compra.
*/
export function ruleBasedReply(text: string, context: BotContext, siteUrl: string) {
  const q = normalize(text);
  const buy = `${siteUrl}/entradas`;
  const hasTicket = context.tickets.some((ticket) => ticket.status === 'PAGADO' || ticket.status === 'SENADO');

  if (
    /(promo|dos personas|2 personas|de a (dos|2)|somos (dos|2)|(vamos|venimos|seriamos) (dos|2)|dos entradas|2 entradas|con mi (pareja|amig|herman|novi|marido|espos|mama|hij|prim))/.test(q)
  ) {
    return [DUO_PROMO_TEXT, '', `Se saca desde acá, con la opción *¿Son 2?*: ${buy}`].join('\n');
  }

  if (/(precio|valor|cuanto|cuesta|sale|costo|cuota|pagar|pago|mercado ?pago|tarjeta|transferencia|efectivo)/.test(q)) {
    return [
      `La Fase 1 tiene un valor regular de ${REGULAR_PRICE_LABEL}: señás ${SPLIT_INSTALLMENT_LABEL} para reservar tu lugar y pagás los otros ${SPLIT_INSTALLMENT_LABEL} ${BALANCE_DEADLINE_LABEL}.`,
      `Pagando hoy en 1 pago sale *${FULL_PRICE_LABEL}* (${FULL_DISCOUNT_PERCENT}% off). Y si venís con alguien: *${DUO_TOTAL_LABEL} las dos personas*, al contado 💙`,
      `Es solo por la Fase 1: el fin de semana del 28 y 29 y ${SUPPORT_LABEL} con Daiana hasta la Fase 2, que tiene otro valor y se comunica a quienes llegan a esa etapa.`,
      `Se paga con Mercado Pago desde acá: ${buy}`,
    ].join('\n');
  }

  if (/(cuando|fecha|horario|hora|donde|lugar|direccion|ubicacion|zona)/.test(q)) {
    return [
      `Es el *${EVENT_DATE_LABEL.toLowerCase()}*, de ${EVENT_HOURS_LABEL} los dos días.`,
      EVENT_ADDRESS
        ? `Es presencial, en ${EVENT_ADDRESS}.`
        : `Es presencial, en ${EVENT_PLACE}. La dirección exacta se envía al confirmar.`,
      `Entradas: ${buy}`,
    ].join('\n');
  }

  if (/(terapia|psicolog|que es|de que se trata|como es|info|informacion)/.test(q)) {
    return [
      'Metamorfosis es un taller vivencial de inteligencia emocional: psicología aplicada, ejercicios guiados y acompañamiento. No es terapia ni la reemplaza.',
      `Es un fin de semana (${EVENT_DATE_LABEL.toLowerCase()}, de ${EVENT_HOURS_LABEL}) para mirar lo que venís cargando y llevarte herramientas para tu día a día.`,
      `Valor regular ${REGULAR_PRICE_LABEL} (seña de ${SPLIT_INSTALLMENT_LABEL} + saldo), o ${FULL_PRICE_LABEL} pagando hoy en 1 pago, e incluye además ${SUPPORT_LABEL} con Daiana hasta la Fase 2: ${buy}`,
    ].join('\n');
  }

  const name = context.pushName?.trim().split(/\s+/)[0];
  return [
    `¡Hola${name ? ` ${name}` : ''}! 🦋 Soy el asistente automático de *Metamorfosis*.`,
    `El taller es el ${EVENT_DATE_LABEL.toLowerCase()}, de ${EVENT_HOURS_LABEL}, en ${EVENT_PLACE}. Valor regular ${REGULAR_PRICE_LABEL}, o ${FULL_PRICE_LABEL} pagando hoy en 1 pago (y promo para dos: ${DUO_TOTAL_LABEL} las dos): ${buy}`,
    hasTicket
      ? 'Escribí *entrada* y te reenvío tu entrada con el QR.'
      : 'Podés preguntarme por el precio, la fecha, el lugar o de qué se trata.',
  ].join('\n');
}

export const MEDIA_REPLY =
  'Por ahora solo puedo leer mensajes de texto 🙏 ¿Me lo escribís? Te respondo enseguida.';
