/*
  Envio de WhatsApp con dos proveedores posibles (se elige por env):

  1) evolution: Evolution API (open source). Se conecta el WhatsApp Business
     que ya tienen escaneando un QR, como WhatsApp Web. Manda texto libre e
     imagenes sin plantillas. Corre en un servidor aparte (Railway, VPS...).
       EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE

  2) cloud: WhatsApp Cloud API oficial de Meta. Para escribirle primero a
     alguien (fuera de la ventana de 24 h) exige plantillas aprobadas.
       WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
       WHATSAPP_USE_TEMPLATES=1 cuando las plantillas esten aprobadas.

  WHATSAPP_PROVIDER=evolution|cloud fuerza uno; si falta, se usa el que este
  configurado. Sin ninguno, la web funciona igual y el admin ofrece botones
  para mandar los mensajes a mano.
*/

export type WhatsAppProvider = 'evolution' | 'cloud' | 'none';

// `error` solo viene cuando ok es false.
export type SendResult = { ok: boolean; provider: WhatsAppProvider; error?: string };

function env(name: string) {
  return (process.env[name] ?? '').trim();
}

function hasEvolution() {
  return Boolean(env('EVOLUTION_API_URL') && env('EVOLUTION_API_KEY') && env('EVOLUTION_INSTANCE'));
}

function hasCloud() {
  return Boolean(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID'));
}

export function getWhatsAppProvider(): WhatsAppProvider {
  const forced = env('WHATSAPP_PROVIDER').toLowerCase();
  if (forced === 'evolution') return hasEvolution() ? 'evolution' : 'none';
  if (forced === 'cloud') return hasCloud() ? 'cloud' : 'none';
  if (hasEvolution()) return 'evolution';
  if (hasCloud()) return 'cloud';
  return 'none';
}

export function cloudTemplatesEnabled() {
  return ['1', 'true', 'yes', 'on'].includes(env('WHATSAPP_USE_TEMPLATES').toLowerCase());
}

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${text.slice(0, 300)}`);
  return text;
}

/* ---------------------------------------------------------------- evolution */

function evolutionUrl(path: string) {
  return `${env('EVOLUTION_API_URL').replace(/\/+$/, '')}${path}/${encodeURIComponent(env('EVOLUTION_INSTANCE'))}`;
}

async function evolutionText(to: string, text: string) {
  await postJson(evolutionUrl('/message/sendText'), { apikey: env('EVOLUTION_API_KEY') }, { number: to, text });
}

// La imagen de la entrada es PNG y el flyer JPG: el tipo sale de la extension.
function imageMeta(imageUrl: string) {
  const isJpg = /\.jpe?g(\?|$)/i.test(imageUrl);
  return isJpg
    ? { mimetype: 'image/jpeg', fileName: 'metamorfosis-7ma-edicion.jpg' }
    : { mimetype: 'image/png', fileName: 'entrada-metamorfosis.png' };
}

async function evolutionImage(to: string, imageUrl: string, caption: string) {
  await postJson(
    evolutionUrl('/message/sendMedia'),
    { apikey: env('EVOLUTION_API_KEY') },
    { number: to, mediatype: 'image', media: imageUrl, ...imageMeta(imageUrl), ...(caption ? { caption } : {}) }
  );
}

/* -------------------------------------------------------------------- cloud */

function cloudUrl() {
  const version = env('WHATSAPP_GRAPH_VERSION') || 'v23.0';
  return `https://graph.facebook.com/${version}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`;
}

function cloudHeaders() {
  return { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}` };
}

async function cloudText(to: string, text: string) {
  await postJson(cloudUrl(), cloudHeaders(), {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text, preview_url: true },
  });
}

async function cloudImage(to: string, imageUrl: string, caption: string) {
  await postJson(cloudUrl(), cloudHeaders(), {
    messaging_product: 'whatsapp',
    to,
    type: 'image',
    image: { link: imageUrl, ...(caption ? { caption } : {}) },
  });
}

async function cloudTemplate(to: string, name: string, params: string[]) {
  await postJson(cloudUrl(), cloudHeaders(), {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name,
      language: { code: env('WHATSAPP_TEMPLATE_LANG') || 'es_AR' },
      components: params.length
        ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: text.replace(/\s+/g, ' ') })) }]
        : [],
    },
  });
}

/* ------------------------------------------------------------------- public */

export type OutgoingWhatsApp = {
  text: string;
  imageUrl?: string | null;
  // Plantilla equivalente para Cloud API (fuera de la ventana de 24 h).
  template?: { name: string; params: string[] } | null;
};

/*
  Manda un mensaje con el proveedor configurado. Con imagen, la imagen va con
  el texto como pie; si la imagen falla se reintenta como texto solo. Sin
  texto (por ejemplo, el flyer) va la imagen sola y, si falla, se informa.
  `inConversation` = la persona nos acaba de escribir (bot), asi que en Cloud
  API se puede mandar texto libre aunque haya plantillas.
*/
export async function sendWhatsApp(
  to: string,
  message: OutgoingWhatsApp,
  options: { inConversation?: boolean } = {}
): Promise<SendResult> {
  const provider = getWhatsAppProvider();
  if (provider === 'none') return { ok: false, provider, error: 'WhatsApp no configurado' };

  try {
    if (provider === 'cloud' && message.template && cloudTemplatesEnabled() && !options.inConversation) {
      await cloudTemplate(to, message.template.name, message.template.params);
      return { ok: true, provider };
    }

    const sendText = provider === 'evolution' ? evolutionText : cloudText;
    const sendImage = provider === 'evolution' ? evolutionImage : cloudImage;

    if (message.imageUrl) {
      if (!message.text.trim()) {
        await sendImage(to, message.imageUrl, '');
        return { ok: true, provider };
      }
      try {
        await sendImage(to, message.imageUrl, message.text);
        return { ok: true, provider };
      } catch (error) {
        console.error('[whatsapp] fallo la imagen, mando solo texto:', error);
      }
    }

    await sendText(to, message.text);
    return { ok: true, provider };
  } catch (error) {
    return { ok: false, provider, error: error instanceof Error ? error.message : String(error) };
  }
}
