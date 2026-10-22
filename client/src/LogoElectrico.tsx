import { useId, useState } from 'react';

// Contorno del logo (X dentro de un círculo) trazado como vector a partir de logo.png: 8 formas, 328 × 323.
const FORMA =
  'M133.8 0.4L111.8 5.9L92.3 14.4L161.8 83.8L166.8 80.1L233 13.4L227.8 10.4L213.8 5.2L197.8 1L189.8 0L162.8 26.6L136.3 0.4Z' +
  'M79.8 20.4L56.8 37.1L49.1 44.4L48.8 46.4L163.8 160.9L279.3 45.4L261.8 29.9L248.8 21.2L244.8 20.2L162.8 102.4Z' +
  'M287.8 55.2L183.2 160.4L288.8 266.4L293.1 262.4L300.2 252.4L308.1 239.4L310.5 233.4L239.5 161.4L311 89.4L301 71.4L289 55.4Z' +
  'M38.8 55.6L26.5 71.4L19.5 83.4L16.8 90.4L84 157.4L86.2 161.4L16.3 231.4L18.4 237.4L27.4 252.4L37.8 266L143.6 160.4Z' +
  'M10.8 103.1L6.6 114.4L3.4 127.4L0 154.4L0.5 176.4L2.6 191.4L7.5 211.4L9.6 217.4L10.8 217.9L67.8 160.4Z' +
  'M316.8 102.8L258 161.4L316.8 219.6L321 208.4L325 192.4L327.8 168.4L327.8 154.4L326 136.4L322.1 118.4Z' +
  'M162.8 162.2L48.8 276L48.8 278.4L69.8 295.9L80.8 301.8L163.8 219L246.8 301.8L248.8 301.6L260.8 293.8L276.4 280.4L279.4 277.4L278.8 276.4L164.8 162.4Z' +
  'M162.8 238L92.8 307.8L92.8 309L111.8 317L133.8 322.2L162.8 294.4L190 321.4L192.8 322.9L209.8 318.9L234.5 309.4L234.8 308.4L233 306.4L164.8 238.4Z';

// Todos los colores salen del color principal de la página (--h y --sat), así que cambian con la paleta.
const ACENTO = 'hsl(var(--h) calc(95% * var(--sat)) 60%)';
const ACENTO_SUAVE = 'hsl(var(--h) calc(100% * var(--sat)) 55%)';
const NUCLEO = 'hsl(var(--h) calc(85% * var(--sat)) 93%)';
const RELLENO = 'hsl(var(--h) calc(75% * var(--sat)) 42% / 0.28)';

const reducirMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Logo con rayos eléctricos dibujado en SVG (vectorial, sin imágenes ni WebGL).
 * Los filamentos "chisporrotean" moviendo un ruido que desplaza el contorno; es muy ligero.
 */
export function LogoElectrico({ tamano = 64, animado = true }: { tamano?: number; animado?: boolean }) {
  const id = useId().replace(/:/g, '');
  const [quieto] = useState(reducirMovimiento);
  const mover = animado && !quieto;
  return (
    <svg
      className="logo-electrico"
      viewBox="-50 -50 428 423"
      width={tamano}
      height={Math.round(tamano * (423 / 428))}
      role="img"
      aria-label="Logo"
      focusable="false"
    >
      <defs>
        {/* Dos filamentos con ruido distinto: dan la sensación de varias hebras de luz. */}
        {[1, 2].map((n) => (
          <filter key={n} id={`${id}-chispa${n}`} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency={n === 1 ? '0.03 0.045' : '0.05 0.03'} numOctaves="2" seed={n * 3} result="ruido">
              {mover && (
                <animate
                  attributeName="seed"
                  values={n === 1 ? '1;4;7;2;9;5;3;8' : '6;2;8;3;1;9;4;7'}
                  dur="1.6s"
                  calcMode="discrete"
                  repeatCount="indefinite"
                />
              )}
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="ruido" scale={n === 1 ? 15 : 11} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        ))}
        <filter id={`${id}-brillo`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="13" />
        </filter>
        <filter id={`${id}-brillo-fino`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{ stopColor: ACENTO_SUAVE, stopOpacity: 0.32 }} />
          <stop offset="70%" style={{ stopColor: ACENTO_SUAVE, stopOpacity: 0.1 }} />
          <stop offset="100%" style={{ stopColor: ACENTO_SUAVE, stopOpacity: 0 }} />
        </radialGradient>
      </defs>

      <circle cx="164" cy="161" r="205" fill={`url(#${id}-halo)`} />

      {/* interior de las franjas, con un tinte del color principal */}
      <path d={FORMA} style={{ fill: RELLENO }} />

      {/* resplandor ancho y desenfocado */}
      <path d={FORMA} fill="none" strokeWidth="26" strokeLinejoin="round" filter={`url(#${id}-brillo)`} style={{ stroke: ACENTO_SUAVE }} opacity="0.75">
        {mover && <animate attributeName="opacity" values="0.55;0.85;0.6;0.8;0.55" dur="3.2s" repeatCount="indefinite" />}
      </path>
      <path d={FORMA} fill="none" strokeWidth="12" strokeLinejoin="round" filter={`url(#${id}-brillo-fino)`} style={{ stroke: ACENTO }} opacity="0.9" />

      {/* filamentos: uno de color y otro más claro, cada uno con su propio ruido */}
      <path d={FORMA} fill="none" strokeWidth="7" strokeLinejoin="round" filter={`url(#${id}-chispa1)`} style={{ stroke: ACENTO }} />
      <path d={FORMA} fill="none" strokeWidth="4" strokeLinejoin="round" filter={`url(#${id}-chispa2)`} style={{ stroke: NUCLEO }} opacity="0.85" />

      {/* núcleo nítido: mantiene la forma legible aunque los filamentos se muevan */}
      <path d={FORMA} fill="none" strokeWidth="3" strokeLinejoin="round" style={{ stroke: NUCLEO }} />
    </svg>
  );
}
