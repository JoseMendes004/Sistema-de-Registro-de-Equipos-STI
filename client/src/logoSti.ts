import { useEffect, useState } from 'react';

const ALTO = 420;
const CENTRO_Y = 223; // centro vertical del círculo en logo.png (480×420)

/**
 * Compone «logo + STI» en una sola imagen (negro sobre blanco; «STI» a la izquierda y el logo a la derecha) para que
 * ElectricLogo dibuje ambos con el mismo efecto.
 */
async function componer(): Promise<string> {
  const logo = new Image();
  logo.src = '/logo.png';
  await logo.decode();
  await document.fonts.load("800 260px 'Inter Variable'", 'STI');

  const medir = document.createElement('canvas').getContext('2d')!;
  const fuente = "800 260px 'Inter Variable', 'Segoe UI', Arial, sans-serif";
  medir.font = fuente;
  medir.letterSpacing = '14px';
  const m = medir.measureText('STI');
  const xTexto = 20;
  const xLogo = Math.ceil(xTexto + m.width + 10);
  const ancho = xLogo + logo.naturalWidth;

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = ALTO;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, ancho, ALTO);
  ctx.drawImage(logo, xLogo, 0);
  ctx.fillStyle = '#000';
  ctx.font = fuente;
  ctx.letterSpacing = '14px';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('STI', xTexto, CENTRO_Y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  return canvas.toDataURL('image/png');
}

/** Devuelve la imagen compuesta cuando está lista (o null mientras se genera). */
export function useLogoSti(activo: boolean) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!activo || src) return;
    let vivo = true;
    componer()
      .then((s) => vivo && setSrc(s))
      .catch(() => vivo && setSrc('/logo.png')); // si algo falla, solo el logo
    return () => {
      vivo = false;
    };
  }, [activo, src]);
  return src;
}
