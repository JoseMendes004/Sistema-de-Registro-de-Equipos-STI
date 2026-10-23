import type { Estado, SistemaOperativo, TipoDisco, TipoEquipo } from './types';

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

export const TIPOS_EQUIPO: { valor: TipoEquipo; nombre: string; prefijo: string }[] = [
  { valor: 'PORTATIL', nombre: 'Portátil', prefijo: 'MOVILES' },
  { valor: 'ESCRITORIO', nombre: 'Escritorio', prefijo: 'EPAREF' },
];
export const SISTEMAS: { valor: SistemaOperativo; nombre: string; letra: string }[] = [
  { valor: 'WINDOWS_10', nombre: 'Windows 10', letra: 'D' },
  { valor: 'WINDOWS_11', nombre: 'Windows 11', letra: 'O' },
  { valor: 'LINUX', nombre: 'Linux', letra: 'L' },
];
export const nombreTipo = (t: TipoEquipo | null) => TIPOS_EQUIPO.find((x) => x.valor === t)?.nombre ?? '—';
export const nombreSistema = (s: SistemaOperativo | null) => SISTEMAS.find((x) => x.valor === s)?.nombre ?? '—';

/** Nombre del equipo: letra del sistema + MOVILES/EPAREF + últimos 6 dígitos de la MAC (igual que en el servidor). */
export function nombreEquipo(so: SistemaOperativo | '', tipo: TipoEquipo | '', mac: string) {
  const s = SISTEMAS.find((x) => x.valor === so);
  const t = TIPOS_EQUIPO.find((x) => x.valor === tipo);
  if (!s || !t) return '';
  return `${s.letra}${t.prefijo}${mac.replace(/[^0-9A-Fa-f]/g, '').toUpperCase().slice(-6)}`;
}

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
