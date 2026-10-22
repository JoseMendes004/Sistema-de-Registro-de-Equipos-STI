// Paleta de colores de la página: un tono de acento (0–360) y un color de fondo.
// La paleta vigente la define el administrador y se guarda en el servidor, así que la ven todos.
// Este navegador conserva una copia (localStorage) para pintar la página sin parpadeo mientras carga.

import { useEffect, useState } from 'react';
import { api } from './api';

export interface Tema {
  h: number;
  /** Intensidad del color principal: 0 = gris, 1 = vivo. */
  s: number;
  fondo: string;
}

export const TEMA_POR_DEFECTO: Tema = { h: 355, s: 1, fondo: '#1f1c1c' };

export const ACENTOS = [
  { nombre: 'Carmesí', h: 355 },
  { nombre: 'Naranja', h: 24 },
  { nombre: 'Dorado', h: 42 },
  { nombre: 'Verde', h: 150 },
  { nombre: 'Turquesa', h: 180 },
  { nombre: 'Azul', h: 215 },
  { nombre: 'Índigo', h: 245 },
  { nombre: 'Violeta', h: 275 },
  { nombre: 'Rosa', h: 325 },
];

export const FONDOS = [
  { nombre: 'Gris oscuro', color: '#1f1c1c' },
  { nombre: 'Negro', color: '#0f0e0e' },
  { nombre: 'Azul noche', color: '#151a26' },
  { nombre: 'Verde bosque', color: '#141d18' },
  { nombre: 'Vino', color: '#25171a' },
];

const CLAVE = 'sti.tema';

export function leerTema(): Tema {
  try {
    const t = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    if (t && Number.isFinite(t.h) && /^#[0-9a-fA-F]{6}$/.test(t.fondo)) {
      const s = Number.isFinite(t.s) ? Math.min(1, Math.max(0, t.s)) : 1;
      return { h: ((Math.round(t.h) % 360) + 360) % 360, s, fondo: t.fondo };
    }
  } catch {
    // sin almacenamiento disponible: se usa la paleta por defecto
  }
  return TEMA_POR_DEFECTO;
}

export function aplicarTema(t: Tema) {
  const raiz = document.documentElement.style;
  raiz.setProperty('--h', String(t.h));
  raiz.setProperty('--sat', String(t.s));
  raiz.setProperty('--fondo-pagina', t.fondo);
}

/** Aplica la paleta a la página, la copia en este navegador y avisa a quien la esté usando. */
export function fijarTema(t: Tema) {
  aplicarTema(t);
  try {
    localStorage.setItem(CLAVE, JSON.stringify(t));
  } catch {
    // se aplica igualmente en esta sesión
  }
  window.dispatchEvent(new Event('sti-tema'));
}

let temporizador: ReturnType<typeof setTimeout> | undefined;

/** Aplica la paleta al instante y la guarda en el servidor (solo el administrador puede). */
export function guardarTema(t: Tema) {
  fijarTema(t);
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    api('/tema', { method: 'PUT', body: t }).catch(() => {});
  }, 500);
}

/** Pide al servidor la paleta vigente (es pública) y la aplica. */
export async function cargarTemaServidor() {
  try {
    const res = await fetch('/api/tema', { cache: 'no-store' });
    if (!res.ok) return;
    const { tema } = await res.json();
    if (tema && Number.isFinite(tema.h) && /^#[0-9a-fA-F]{6}$/.test(tema.fondo)) {
      fijarTema({ h: tema.h, s: Number.isFinite(tema.s) ? tema.s : 1, fondo: tema.fondo });
    }
  } catch {
    // sin conexión: se queda con la copia guardada
  }
}

/** Paleta actual, que se actualiza sola cuando cambia. */
export function useTemaActual() {
  const [t, setT] = useState<Tema>(leerTema);
  useEffect(() => {
    const alCambiar = () => setT(leerTema());
    window.addEventListener('sti-tema', alCambiar);
    return () => window.removeEventListener('sti-tema', alCambiar);
  }, []);
  return t;
}

/** Tono (0–360) e intensidad (0–1) del color principal que corresponde a un color #rrggbb cualquiera. */
export function acentoDe(hex: string): { h: number; s: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? TEMA_POR_DEFECTO.h : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  // Los colores ya vivos (saturación ≥ 80 %) usan la intensidad completa.
  return { h: Math.round((h * 60 + 360) % 360), s: Math.min(1, sat / 0.8) };
}

/** Color #rrggbb a partir de un tono, saturación y luminosidad (0–100). */
export function hexDeTono(h: number, s: number, l: number): string {
  const sa = s / 100;
  const li = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sa * Math.min(li, 1 - li);
  const f = (n: number) => li - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const x = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${x(f(0))}${x(f(8))}${x(f(4))}`;
}

// ===== Paletas propias guardadas por la persona =====
export interface Paleta extends Tema {
  id: string;
  nombre: string;
}

export const MAX_PALETAS = 12;

/** Paletas guardadas por el administrador (en el servidor). */
export async function cargarPaletas(): Promise<Paleta[]> {
  const r = await api<{ paletas: Paleta[] }>('/tema/paletas');
  return r.paletas;
}

export async function guardarPaletas(lista: Paleta[]) {
  await api('/tema/paletas', { method: 'PUT', body: { paletas: lista } });
}
