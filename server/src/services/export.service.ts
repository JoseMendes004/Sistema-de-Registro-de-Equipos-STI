import ExcelJS from 'exceljs';
import { config } from '../config.ts';

const fmtFecha = new Intl.DateTimeFormat('es-VE', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: config.zonaHoraria,
});
const fecha = (d: Date | null) => (d ? fmtFecha.format(d) : '');

const DISCOS: Record<string, string> = { HDD: 'HDD', SSD: 'SSD', OTRO: 'Otro', NO_ESPECIFICADO: 'No especificado' };

const COLUMNAS: { titulo: string; ancho: number; valor: (e: any, total: number) => string | number }[] = [
  { titulo: 'N° Registro', ancho: 12, valor: (e) => e.numero_registro },
  { titulo: 'Fecha de ingreso', ancho: 18, valor: (e) => fecha(e.fecha_ingreso) },
  { titulo: 'Usuario / Propietario', ancho: 24, valor: (e) => e.usuario_propietario },
  { titulo: 'Etiqueta', ancho: 14, valor: (e) => e.etiqueta },
  { titulo: 'Equipo (modelo)', ancho: 22, valor: (e) => e.modelo },
  { titulo: 'MAC', ancho: 20, valor: (e) => e.mac },
  { titulo: 'Nombre del equipo', ancho: 22, valor: (e) => e.nombre_equipo },
  { titulo: 'Analista', ancho: 22, valor: (e) => e.analista },
  { titulo: 'Estación', ancho: 10, valor: (e) => e.estacion },
  { titulo: 'Actividades', ancho: 12, valor: (e, t) => `${e.actividades_hechas}/${t}` },
  { titulo: 'Actividades realizadas', ancho: 60, valor: (e) => e.actividades_detalle ?? '' },
  { titulo: 'Disco', ancho: 16, valor: (e) => DISCOS[e.tipo_disco] ?? e.tipo_disco },
  { titulo: 'Capacidad', ancho: 12, valor: (e) => e.capacidad_disco },
  { titulo: 'RAM', ancho: 10, valor: (e) => e.ram },
  { titulo: 'Estado', ancho: 18, valor: (e) => e.estado },
  { titulo: 'Fecha de salida', ancho: 18, valor: (e) => fecha(e.fecha_salida) },
  { titulo: 'Retirado por', ancho: 22, valor: (e) => e.retirado_por ?? '' },
  { titulo: 'Entregado por', ancho: 22, valor: (e) => e.entregado_por ?? '' },
  { titulo: 'Observaciones', ancho: 40, valor: (e) => e.observaciones },
];

// Evita que Excel interprete como fórmula un texto introducido por un usuario.
const neutralizar = (v: string | number) =>
  typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;

export function generarCsv(items: any[], totalActividades: number): string {
  const celda = (v: string | number) => `"${String(neutralizar(v)).replace(/"/g, '""')}"`;
  const lineas = [COLUMNAS.map((c) => celda(c.titulo)).join(';')];
  for (const e of items) lineas.push(COLUMNAS.map((c) => celda(c.valor(e, totalActividades))).join(';'));
  // BOM + separador ";" para que Excel en español lo abra directamente.
  return '﻿' + lineas.join('\r\n');
}

export function generarXlsx(items: any[], totalActividades: number) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Registro de Equipos — STI';
  const ws = wb.addWorksheet('Registros');
  ws.columns = COLUMNAS.map((c) => ({ header: c.titulo, width: c.ancho }));
  for (const e of items) ws.addRow(COLUMNAS.map((c) => neutralizar(c.valor(e, totalActividades))));
  const cabecera = ws.getRow(1);
  cabecera.font = { bold: true, color: { argb: 'FFF5F2ED' } };
  cabecera.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B0D1A' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return wb;
}
