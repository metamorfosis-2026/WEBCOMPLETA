/*
  Mariposa de marca, dibujada en SVG (no depende de assets externos).
  Se usa como ícono del menú y como marca de agua del panel móvil.
*/
export function ButterflyMark({
  className,
  filled = false,
  strokeWidth = 3,
}: {
  className?: string;
  filled?: boolean;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
        fillOpacity={filled ? 0.14 : 0}
      >
        {/* alas superiores */}
        <ellipse cx="31" cy="37" rx="19" ry="26" transform="rotate(-30 31 37)" />
        <ellipse cx="69" cy="37" rx="19" ry="26" transform="rotate(30 69 37)" />
        {/* alas inferiores */}
        <ellipse cx="38" cy="68" rx="13" ry="17" transform="rotate(-18 38 68)" />
        <ellipse cx="62" cy="68" rx="13" ry="17" transform="rotate(18 62 68)" />
        {/* cuerpo */}
        <path d="M50 27v49" />
        {/* antenas */}
        <path d="M50 28c-2-6-7-9-11-11" fill="none" />
        <path d="M50 28c2-6 7-9 11-11" fill="none" />
      </g>
    </svg>
  );
}
