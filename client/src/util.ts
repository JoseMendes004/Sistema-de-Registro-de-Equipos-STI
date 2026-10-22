import type { Estado, TipoDisco } from './types';

const fmtFechaHora = new Intl.DateTimeFormat('es-VE', { dateStyle: 'short', timeStyle: 'short' });
const fmtFecha = new Intl.DateTimeFormat('es-VE', { dateStyle: 'short' });
const fmtHora = new Intl.DateTimeFormat('es-VE', { timeStyle: 'short' });

export const fechaHora = (iso: string | null) => (iso ? fmtFechaHora.format(new Date(iso)) : '—');
export const soloFecha = (iso: string | null) => (iso ? fmtFecha.format(new Date(iso)) : '—');
export const soloHora = (iso: string | null) => (iso ? fmtHora.format(new Date(iso)) : '');

export const numeroRegistro = (n: number) => String(n).padStart(3, '0');

export const porcentaje = (hechas: number, total: number) => (total > 0 ? Math.round((hechas / total) * 100) : 0);

export const DISCOS: { valor: TipoDisco; nombre: string; detalle: string }[] = [
  { valor: 'HDD', nombre: 'HDD', detalle: 'Disco duro' },
  { valor: 'SSD', nombre: 'SSD', detalle: 'Estado sólido' },
  { valor: 'OTRO', nombre: 'Otro', detalle: 'Otro tipo' },
  { valor: 'NO_ESPECIFICADO', nombre: 'N/E', detalle: 'No especificado' },
];
export const nombreDisco = (t: TipoDisco) => (t === 'NO_ESPECIFICADO' ? 'No esp.' : t === 'OTRO' ? 'Otro' : t);

export const CAPACIDADES = ['128 GB', '256 GB', '500 GB', '512 GB', '1 TB', '2 TB'];
export const MEMORIAS = ['2 GB', '4 GB', '8 GB', '16 GB', '32 GB', '64 GB'];

export const claseEstado: Record<Estado, string> = {
  Recibido: 'neutro',
  'En revisión': 'info',
  'En proceso': 'naranja',
  Pendiente: 'rojo',
  'Listo para entregar': 'verde-suave',
  Entregado: 'verde',
  Retirado: 'apagado',
};

/** Valor para un <input type="datetime-local"> en hora local. */
export function ahoraLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
