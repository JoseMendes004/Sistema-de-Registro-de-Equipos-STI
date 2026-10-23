import { z } from 'zod';
import { pool } from '../db.ts';
import type { Cliente } from '../db.ts';
import type { Sesion } from '../middleware/auth.ts';

export const ESTADOS = [
  'Recibido',
  'En revisión',
  'En proceso',
  'Pendiente',
  'Listo para entregar',
  'Entregado',
  'Retirado',
] as const;
export type Estado = (typeof ESTADOS)[number];

export type TipoHistorial = 'INGRESO' | 'EDICION' | 'ACTIVIDAD' | 'ESTADO' | 'SALIDA';

type Ejecutor = Pick<Cliente, 'query'>;

export async function registrarHistorial(
  c: Ejecutor,
  equipoId: number,
  usuarioId: number,
  tipo: TipoHistorial,
  descripcion: string,
  detalle: Record<string, unknown> = {},
  fecha: Date = new Date(),
) {
  await c.query(
    `INSERT INTO historial_modificaciones (equipo_id, usuario_id, tipo, descripcion, detalle, fecha)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [equipoId, usuarioId, tipo, descripcion, JSON.stringify(detalle), fecha],
  );
}

export async function registrarCambioEstado(
  c: Ejecutor,
  equipoId: number,
  usuarioId: number,
  anterior: string | null,
  nuevo: string,
  fecha: Date = new Date(),
) {
  await c.query(
    `INSERT INTO historial_estados (equipo_id, estado_anterior, estado_nuevo, analista_id, fecha)
     VALUES ($1, $2, $3, $4, $5)`,
    [equipoId, anterior, nuevo, usuarioId, fecha],
  );
}

const fechaDia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.')
  .optional();

export const filtrosSchema = z.object({
  q: z.string().trim().max(100).optional(),
  estado: z.enum(ESTADOS).optional(),
  desde: fechaDia,
  hasta: fechaDia,
  salida_desde: fechaDia,
  salida_hasta: fechaDia,
  estacion: z.string().trim().max(60).optional(),
  analista_id: z.coerce.number().int().positive().optional(),
  modelo: z.string().trim().max(100).optional(),
  // si: solo casos cerrados (Reportes); no: solo casos abiertos (Registro de equipos).
  cerrado: z.enum(['si', 'no']).optional(),
  orden: z.enum(['fecha_desc', 'fecha_asc']).default('fecha_desc'),
  pagina: z.coerce.number().int().min(1).default(1),
  por_pagina: z.coerce.number().int().min(1).max(1000).default(10),
});
export type Filtros = z.infer<typeof filtrosSchema>;

const escaparLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

const SELECT_EQUIPO = `
  SELECT e.id, e.numero_registro, e.fecha_ingreso, e.usuario_propietario, e.etiqueta, e.modelo, e.mac,
         e.nombre_equipo, e.analista_id, u.nombre || ' ' || u.apellido AS analista,
         u.indicador AS analista_indicador, e.estacion, e.tipo_disco, e.capacidad_disco, e.ram,
         e.estado, e.observaciones, e.cerrado_en, e.tipo_equipo, e.sistema_operativo,
         s.fecha_salida, s.retirado_por, s.observaciones AS salida_observaciones,
         su.nombre || ' ' || su.apellido AS entregado_por,
         (SELECT count(*)::int FROM equipo_actividades ea
            JOIN actividades a ON a.id = ea.actividad_id
           WHERE ea.equipo_id = e.id AND ea.completada AND a.activa) AS actividades_hechas,
         (SELECT string_agg(a.nombre, '; ' ORDER BY a.orden) FROM equipo_actividades ea
            JOIN actividades a ON a.id = ea.actividad_id
           WHERE ea.equipo_id = e.id AND ea.completada) AS actividades_detalle
    FROM equipos e
    JOIN usuarios u ON u.id = e.analista_id
    LEFT JOIN salidas s ON s.equipo_id = e.id
    LEFT JOIN usuarios su ON su.id = s.analista_id`;

function construirWhere(f: Filtros) {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  if (f.q) {
    const n = p(`%${escaparLike(f.q)}%`);
    const partes = [
      `e.usuario_propietario ILIKE ${n}`,
      `e.etiqueta ILIKE ${n}`,
      `e.modelo ILIKE ${n}`,
      `e.mac ILIKE ${n}`,
      `e.nombre_equipo ILIKE ${n}`,
      `(u.nombre || ' ' || u.apellido) ILIKE ${n}`,
      `u.indicador ILIKE ${n}`,
    ];
    // Permite buscar una MAC escrita con otro separador (o sin separadores).
    const hex = f.q.replace(/[-:.\s]/g, '');
    if (hex.length >= 4 && /^[0-9a-f]+$/i.test(hex)) {
      partes.push(`replace(e.mac, '-', '') ILIKE ${p(`%${hex}%`)}`);
    }
    where.push(`(${partes.join(' OR ')})`);
  }
  if (f.cerrado === 'si') where.push('e.cerrado_en IS NOT NULL');
  if (f.cerrado === 'no') where.push('e.cerrado_en IS NULL');
  if (f.estado) where.push(`e.estado = ${p(f.estado)}`);
  if (f.desde) where.push(`e.fecha_ingreso >= ${p(f.desde)}::date`);
  if (f.hasta) where.push(`e.fecha_ingreso < ${p(f.hasta)}::date + 1`);
  if (f.salida_desde) where.push(`s.fecha_salida >= ${p(f.salida_desde)}::date`);
  if (f.salida_hasta) where.push(`s.fecha_salida < ${p(f.salida_hasta)}::date + 1`);
  if (f.estacion) where.push(`e.estacion = ${p(f.estacion)}`);
  if (f.analista_id) where.push(`e.analista_id = ${p(f.analista_id)}`);
  if (f.modelo) where.push(`e.modelo ILIKE ${p(`%${escaparLike(f.modelo)}%`)}`);

  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export async function totalActividadesActivas(c: Ejecutor = pool): Promise<number> {
  const { rows } = await c.query('SELECT count(*)::int AS n FROM actividades WHERE activa');
  return rows[0].n;
}

export async function listarEquipos(f: Filtros, paginar: boolean) {
  const w = construirWhere(f);
  const orden = f.orden === 'fecha_asc' ? 'ASC' : 'DESC';
  let sql = `${SELECT_EQUIPO} ${w.sql} ORDER BY e.fecha_ingreso ${orden}, e.id ${orden}`;
  const params = [...w.params];
  if (paginar) {
    params.push(f.por_pagina, (f.pagina - 1) * f.por_pagina);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
  } else {
    sql += ' LIMIT 10000';
  }
  const [items, total, totalActividades] = await Promise.all([
    pool.query(sql, params),
    pool.query(
      `SELECT count(*)::int AS n FROM equipos e
         JOIN usuarios u ON u.id = e.analista_id
         LEFT JOIN salidas s ON s.equipo_id = e.id ${w.sql}`,
      w.params,
    ),
    totalActividadesActivas(),
  ]);
  return {
    items: items.rows,
    total: total.rows[0].n as number,
    pagina: f.pagina,
    por_pagina: f.por_pagina,
    total_actividades: totalActividades,
  };
}

export async function obtenerEquipo(id: number, c: Ejecutor = pool) {
  const { rows } = await c.query(`${SELECT_EQUIPO} WHERE e.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function obtenerHistorial(id: number) {
  const { rows } = await pool.query(
    `SELECT h.id, h.tipo, h.descripcion, h.detalle, h.fecha, u.nombre || ' ' || u.apellido AS usuario
       FROM historial_modificaciones h
       JOIN usuarios u ON u.id = h.usuario_id
      WHERE h.equipo_id = $1
      ORDER BY h.fecha, h.id`,
    [id],
  );
  return rows;
}

export async function obtenerActividadesDeEquipo(id: number) {
  const { rows } = await pool.query(
    `SELECT a.id, a.orden, a.nombre, a.categoria, a.activa,
            COALESCE(ea.completada, FALSE) AS completada, ea.completada_en,
            CASE WHEN ea.completada THEN u.nombre || ' ' || u.apellido END AS analista
       FROM actividades a
       LEFT JOIN equipo_actividades ea ON ea.actividad_id = a.id AND ea.equipo_id = $1
       LEFT JOIN usuarios u ON u.id = ea.analista_id
      WHERE a.activa OR COALESCE(ea.completada, FALSE)
      ORDER BY a.orden, a.id`,
    [id],
  );
  return rows;
}
