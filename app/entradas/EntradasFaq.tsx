import {
  BALANCE_DEADLINE_LABEL,
  EVENT_PLACE,
  FULL_PRICE_LABEL,
  SPLIT_INSTALLMENT_LABEL,
  SPLIT_TOTAL_LABEL,
} from '@/app/lib/entradas';

/*
  Preguntas frecuentes de /entradas. Las respuestas salen de lo que ya dicen la
  home, los mensajes de WhatsApp y la guia del bot: no agregar datos nuevos aca
  sin cambiarlos tambien alla.
  details/summary nativo: se abre con teclado y lo anuncian los lectores de
  pantalla sin JavaScript.
*/
const FAQ = [
  {
    question: '¿Cómo pago?',
    answer:
      'Con Mercado Pago: tarjeta de crédito o débito, dinero en cuenta o efectivo en Rapipago o Pago Fácil. Con tarjeta de crédito, Mercado Pago puede ofrecerte cuotas con su propio interés. Esta web nunca ve los datos de tu tarjeta.',
  },
  {
    question: '¿Cuándo me llega la entrada?',
    answer:
      'Apenas se acredita el pago te llega por WhatsApp tu entrada con un QR personal, que se escanea en la puerta los dos días. Si pagás en efectivo, puede tardar unas horas en acreditarse.',
  },
  {
    question: '¿Dónde es?',
    answer: `Es presencial, en ${EVENT_PLACE}. La dirección exacta te la mandamos por WhatsApp al confirmar tu entrada.`,
  },
  {
    question: '¿Cómo es el plan en 2 pagos?',
    answer: `Son ${SPLIT_TOTAL_LABEL} en dos pagos de ${SPLIT_INSTALLMENT_LABEL}. El primero reserva tu lugar y el segundo lo pagás ${BALANCE_DEADLINE_LABEL}, con el link que te llega por WhatsApp. En un solo pago sale ${FULL_PRICE_LABEL}.`,
  },
];

export function EntradasFaq({ className = '' }: { className?: string }) {
  return (
    <section aria-labelledby="preguntas-frecuentes" className={`text-center lg:text-left ${className}`}>
      <h2 id="preguntas-frecuentes" className="text-[17px] font-semibold text-white">
        Preguntas frecuentes
      </h2>
      <div className="mt-4 divide-y divide-ivory/10 overflow-hidden rounded-2xl border border-ivory/10 bg-white/[0.03]">
        {FAQ.map(({ question, answer }) => (
          <details key={question} className="group">
            {/* Celular: pregunta e icono centrados juntos. Escritorio: icono a la derecha. */}
            <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-center gap-3 px-4 py-3 text-[15px] font-medium text-ivory/90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-celeste/70 lg:justify-between lg:px-5 [@media(hover:hover)]:hover:text-white [&::-webkit-details-marker]:hidden">
              <span>{question}</span>
              <span
                aria-hidden="true"
                className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-ivory/20 text-celeste transition-transform duration-200 group-open:rotate-45"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                  <path d="M12 6v12M6 12h12" />
                </svg>
              </span>
            </summary>
            <p className="px-5 pb-5 text-[14px] leading-relaxed text-ivory/75 [text-wrap:balance] lg:pr-12 lg:[text-wrap:pretty]">
              {answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
