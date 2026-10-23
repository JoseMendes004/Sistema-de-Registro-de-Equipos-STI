import { Router } from 'express';
import { z } from 'zod';
import { tx } from '../db.ts';
import type { Cliente } from '../db.ts';
import { requireRole, usuarioDe } from '../middleware/auth.ts';
import type { Sesion } from '../middleware/auth.ts';
import { HttpError } from '../middleware/error.ts';
import { idParam, texto, textoOpcional, validar } from '../middleware/validate.ts';
import {
  ESTADOS,
  filtrosSchema,
  listarEquipos,
  obtenerActividadesDeEquipo,
  obtenerEquipo,
  obtenerHistorial,
  registrarCambioEstado,
  registrarHistorial,
  totalActividadesActivas,
} from '../services/equipos.service.ts';

export const equiposRouter = Router();

const MAC_RE = /^[0-9A-Fa-f]{2}([-:.]?[0-9A-Fa-f]{2}){5}$/;

// El nombre del equipo se genera: sistema operativo (D/O/L) + tipo (MOVILES/EPAREF) + últimos 6 dígitos de la MAC.
const LETRA_SO = { WINDOWS_10: 'D', WINDOWS_11: 'O', LINUX: 'L' } as const;
const NOMBRE_TIPO = { PORTATIL: 'MOVILES', ESCRITORIO: 'EPAREF' } as const;

const equipoBase = z.object({
  usuario_propietario: texto('El usuario'),
  etiqueta: texto('La etiqueta', 60),
  modelo: texto('El modelo'),
  mac: texto('La dirección MAC', 20)
    .regex(MAC_RE, 'MAC inválida. Formato esperado: 00-34-7E-0F-E8-38.')
    .transform((v) => v.replace(/[^0-9A-Fa-f]/g, '').toUpperCase().match(/.{2}/g)!.join('-')),
  tipo_equipo: z.enum(['PORTATIL', 'ESCRITORIO'], { error: 'Elige el tipo de equipo.' }),
  sistema_operativo: z.enum(['WINDOWS_10', 'WINDOWS_11', 'LINUX'], { error: 'Elige el sistema operativo.' }),
  tipo_disco: z.enum(['HDD', 'SSD', 'OTRO', 'NO_ESPECIFICADO']).default('NO_ESPECIFICADO'),
  capacidad_disco: textoOpcional(30),
  ram: textoOpcional(30),
  observaciones: textoOpcional(2000),
});

const equipoSchema = equipoBase.transform((d) => ({
  ...d,
  nombre_equipo: `${LETRA_SO[d.sistema_operativo]}${NOMBRE_TIPO[d.tipo_equipo]}${d.mac.replace(/-/g, '').slice(-6)}`,
}));

const CAMPOS_EDITABLES = [...Object.keys(equipoBase.shape), 'nombre_equipo'] as (keyof z.infer<typeof equipoSchema>)[];

const ETIQUETAS: Record<string, string> = {
  usuario_propietario: 'usuario',
  etiqueta: 'etiqueta',
  modelo: 'modelo',
  mac: 'MAC',
  nombre_equipo: 'nombre del equipo',
  tipo_equipo: 'tipo de equipo',
  sistema_operativo: 'sistema operativo',
  tipo_disco: 'tipo de disco',
  capacidad_disco: 'capacidad del disco',
  ram: 'memoria RAM',
  observaciones: 'observaciones',
};

/** La salida se permite con este mínimo de actividades completadas; el caso se cierra al 100 %. */
const SALIDA_MINIMA = 12;

/** Bloquea la fila del equipo. Cualquier analista puede trabajar sobre cualquier equipo abierto. */
async function bloquearEquipo(c: Cliente, id: number, u: Sesion, opciones: { permiteCerrado?: boolean } = {}) {
  const { rows } = await c.query('SELECT * FROM equipos WHERE id = $1 FOR UPDATE', [id]);
  const equipo = rows[0];
  if (!equipo) throw new HttpError(404, 'Equipo no encontrado.');
  if (equipo.cerrado_en && !opciones.permiteCerrado) {
    throw new HttpError(409, 'El caso está cerrado y ya no admite cambios.');
  }
  return equipo;
}

/** Las primeras SALIDA_MINIMA actividades activas (por orden) que el equipo ya completó. */
async function primerasHechas(c: Cliente, id: number) {
  const { rows } = await c.query(
    `SELECT count(*) FILTER (WHERE ea.completada)::int AS hechas, count(*)::int AS total
       FROM (SELECT id FROM actividades WHERE activa ORDER BY orden, id LIMIT $2) a
       LEFT JOIN equipo_actividades ea ON ea.actividad_id = a.id AND ea.equipo_id = $1`,
    [id, SALIDA_MINIMA],
  );
  return { hechas: rows[0].hechas as number, total: rows[0].total as number };
}

/** Actividades completadas y total de actividades activas de un equipo. */
async function avance(c: Cliente, id: number) {
  const { rows } = await c.query(
    `SELECT count(*) FILTER (WHERE ea.completada AND a.activa)::int AS hechas,
            (SELECT count(*)::int FROM actividades WHERE activa) AS total
       FROM equipo_actividades ea JOIN actividades a ON a.id = ea.actividad_id
      WHERE ea.equipo_id = $1`,
    [id],
  );
  return { hechas: rows[0]?.hechas ?? 0, total: rows[0]?.total ?? 0 };
}

equiposRouter.get('/', async (req, res) => {
  const f = validar(filtrosSchema, req.query);
  res.json(await listarEquipos(f, true));
});

equiposRouter.post('/', async (req, res) => {
  const d = validar(equipoSchema, req.body);
  const u = usuarioDe(res);
  // El analista y la estación se toman siempre de la sesión, nunca del formulario.
  const id = await tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO equipos (usuario_propietario, etiqueta, modelo, mac, nombre_equipo, analista_id, estacion,
                            tipo_disco, capacidad_disco, ram, observaciones, tipo_equipo, sistema_operativo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id, numero_registro`,
      [d.usuario_propietario, d.etiqueta, d.modelo, d.mac, d.nombre_equipo, u.id, u.estacion,
       d.tipo_disco, d.capacidad_disco, d.ram, d.observaciones, d.tipo_equipo, d.sistema_operativo],
    );
    await registrarHistorial(c, rows[0].id, u.id, 'INGRESO', 'Equipo ingresado al laboratorio', {
      numero_registro: rows[0].numero_registro,
    });
    await registrarCambioEstado(c, rows[0].id, u.id, null, 'Recibido');
    return rows[0].id as number;
  });
  res.status(201).json({ equipo: await obtenerEquipo(id) });
});

equiposRouter.get('/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const equipo = await obtenerEquipo(id);
  if (!equipo) throw new HttpError(404, 'Equipo no encontrado.');
  const u = usuarioDe(res);
  const [actividades, historial, total] = await Promise.all([
    obtenerActividadesDeEquipo(id),
    obtenerHistorial(id),
    totalActividadesActivas(),
  ]);
  const puedeOperar = !equipo.cerrado_en;
  res.json({
    equipo,
    actividades,
    historial,
    total_actividades: total,
    puede_operar: puedeOperar,
    puede_editar: u.rol === 'admin' || puedeOperar,
  });
});

equiposRouter.get('/:id/historial', async (req, res) => {
  res.json({ items: await obtenerHistorial(idParam(req.params.id)) });
});

equiposRouter.put('/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const d = validar(equipoSchema, req.body);
  const u = usuarioDe(res);
  await tx(async (c) => {
    const antes = await bloquearEquipo(c, id, u, { permiteCerrado: u.rol === 'admin' });
    const cambios: Record<string, [unknown, unknown]> = {};
    for (const k of CAMPOS_EDITABLES) if (antes[k] !== d[k]) cambios[k] = [antes[k], d[k]];
    if (!Object.keys(cambios).length) return;
    await c.query(
      `UPDATE equipos SET usuario_propietario = $1, etiqueta = $2, modelo = $3, mac = $4, nombre_equipo = $5,
              tipo_disco = $6, capacidad_disco = $7, ram = $8, observaciones = $9,
              tipo_equipo = $10, sistema_operativo = $11, actualizado_en = now()
        WHERE id = $12`,
      [d.usuario_propietario, d.etiqueta, d.modelo, d.mac, d.nombre_equipo, d.tipo_disco, d.capacidad_disco,
       d.ram, d.observaciones, d.tipo_equipo, d.sistema_operativo, id],
    );
    const nombres = Object.keys(cambios).map((k) => ETIQUETAS[k]).join(', ');
    await registrarHistorial(c, id, u.id, 'EDICION', `Datos editados: ${nombres}`, cambios);
  });
  res.json({ equipo: await obtenerEquipo(id) });
});

equiposRouter.put('/:id/actividades/:actividadId', async (req, res) => {
  const id = idParam(req.params.id);
  const actividadId = idParam(req.params.actividadId);
  const d = validar(z.object({ completada: z.boolean() }), req.body);
  const u = usuarioDe(res);
  await tx(async (c) => {
    await bloquearEquipo(c, id, u);
    const act = await c.query('SELECT nombre, activa FROM actividades WHERE id = $1', [actividadId]);
    if (!act.rows[0]) throw new HttpError(404, 'Actividad no encontrada.');
    const previa = await c.query(
      'SELECT completada FROM equipo_actividades WHERE equipo_id = $1 AND actividad_id = $2',
      [id, actividadId],
    );
    if ((previa.rows[0]?.completada ?? false) === d.completada) return;
    await c.query(
      `INSERT INTO equipo_actividades (equipo_id, actividad_id, completada, completada_en, analista_id)
       VALUES ($1, $2, $3, CASE WHEN $3 THEN now() END, $4)
       ON CONFLICT (equipo_id, actividad_id) DO UPDATE
         SET completada = EXCLUDED.completada, completada_en = EXCLUDED.completada_en,
             analista_id = EXCLUDED.analista_id`,
      [id, actividadId, d.completada, u.id],
    );
    await c.query('UPDATE equipos SET actualizado_en = now() WHERE id = $1', [id]);
    await registrarHistorial(
      c, id, u.id, 'ACTIVIDAD',
      `${d.completada ? 'Actividad completada' : 'Actividad desmarcada'}: ${act.rows[0].nombre}`,
      { actividad_id: actividadId, completada: d.completada },
    );
  });
  const [actividades, equipo] = await Promise.all([obtenerActividadesDeEquipo(id), obtenerEquipo(id)]);
  res.json({ actividades, equipo, historial: await obtenerHistorial(id) });
});

equiposRouter.put('/:id/estado', async (req, res) => {
  const id = idParam(req.params.id);
  const d = validar(z.object({ estado: z.enum(ESTADOS) }), req.body);
  if (d.estado === 'Entregado') {
    throw new HttpError(400, 'Para cerrar el caso usa «Cerrar caso» (requiere la salida y el 100 % de las actividades).');
  }
  const u = usuarioDe(res);
  await tx(async (c) => {
    const antes = await bloquearEquipo(c, id, u);
    if (antes.estado === d.estado) return;
    await c.query('UPDATE equipos SET estado = $1, actualizado_en = now() WHERE id = $2', [d.estado, id]);
    await registrarCambioEstado(c, id, u.id, antes.estado, d.estado);
    await registrarHistorial(c, id, u.id, 'ESTADO', `Estado: ${antes.estado} → ${d.estado}`, {
      anterior: antes.estado,
      nuevo: d.estado,
    });
  });
  res.json({ equipo: await obtenerEquipo(id), historial: await obtenerHistorial(id) });
});

equiposRouter.post('/:id/salida', async (req, res) => {
  const id = idParam(req.params.id);
  const d = validar(
    z.object({
      fecha_salida: z.coerce.date({ error: 'Indica la fecha y hora de salida.' }),
      retirado_por: texto('El nombre de quien retira'),
      observaciones: textoOpcional(2000),
    }),
    req.body,
  );
  const u = usuarioDe(res);
  await tx(async (c) => {
    const antes = await bloquearEquipo(c, id, u);
    const { hechas, total } = await avance(c, id);
    const primeras = await primerasHechas(c, id);
    if (primeras.hechas < primeras.total) {
      throw new HttpError(
        409,
        `Para registrar la salida deben estar completas las primeras ${primeras.total} actividades (llevas ${primeras.hechas}).`,
      );
    }
    const ya = await c.query('SELECT 1 FROM salidas WHERE equipo_id = $1', [id]);
    if (ya.rowCount) throw new HttpError(409, 'La salida de este equipo ya fue registrada.');

    const campos: Record<string, string> = {};
    if (d.fecha_salida < antes.fecha_ingreso) campos.fecha_salida = 'La salida no puede ser anterior al ingreso.';
    else if (d.fecha_salida.getTime() > Date.now() + 5 * 60 * 1000) campos.fecha_salida = 'La salida no puede estar en el futuro.';
    if (Object.keys(campos).length) throw new HttpError(400, 'Revisa los campos marcados.', campos);

    await c.query(
      `INSERT INTO salidas (equipo_id, fecha_salida, retirado_por, observaciones, analista_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, d.fecha_salida, d.retirado_por, d.observaciones, u.id],
    );
    await c.query('UPDATE equipos SET actualizado_en = now() WHERE id = $1', [id]);
    // La salida no cierra el caso: el equipo sigue editable hasta completar el 100 % de las actividades.
    await registrarHistorial(c, id, u.id, 'SALIDA', `Salida registrada: retira ${d.retirado_por}. Caso abierto hasta completar el 100 %.`, {
      fecha_salida: d.fecha_salida,
      retirado_por: d.retirado_por,
      actividades: `${hechas}/${total}`,
    });
  });
  res.status(201).json({ equipo: await obtenerEquipo(id), historial: await obtenerHistorial(id) });
});

// Cierra el caso: exige la salida registrada y el 100 % de las actividades.
// El equipo sale del registro de equipos y pasa a Reportes.
equiposRouter.post('/:id/cerrar', async (req, res) => {
  const id = idParam(req.params.id);
  const u = usuarioDe(res);
  await tx(async (c) => {
    const antes = await bloquearEquipo(c, id, u);
    const salida = await c.query('SELECT 1 FROM salidas WHERE equipo_id = $1', [id]);
    if (!salida.rowCount) throw new HttpError(409, 'Primero registra la salida del equipo.');
    const { hechas, total } = await avance(c, id);
    if (hechas < total) {
      throw new HttpError(409, `Para cerrar el caso se necesita el 100 % de las actividades (llevas ${hechas} de ${total}).`);
    }
    await c.query(`UPDATE equipos SET cerrado_en = now(), estado = 'Entregado', actualizado_en = now() WHERE id = $1`, [id]);
    await registrarCambioEstado(c, id, u.id, antes.estado, 'Entregado');
    await registrarHistorial(c, id, u.id, 'ESTADO', 'Caso cerrado: el equipo sale del registro y pasa a Reportes.', {
      estado_anterior: antes.estado,
    });
  });
  res.json({ equipo: await obtenerEquipo(id), historial: await obtenerHistorial(id) });
});

equiposRouter.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = idParam(req.params.id);
  const r = await tx((c) => c.query('DELETE FROM equipos WHERE id = $1', [id]));
  if (!r.rowCount) throw new HttpError(404, 'Equipo no encontrado.');
  res.json({ ok: true });
});
