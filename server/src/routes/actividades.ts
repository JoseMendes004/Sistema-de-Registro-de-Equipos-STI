import { Router } from 'express';
import { z } from 'zod';
import { pool, tx } from '../db.ts';
import { requireRole } from '../middleware/auth.ts';
import { HttpError } from '../middleware/error.ts';
import { idParam, texto, textoOpcional, validar } from '../middleware/validate.ts';

export const actividadesRouter = Router();

actividadesRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.orden, a.nombre, a.categoria, a.activa,
            (SELECT count(*)::int FROM equipo_actividades ea WHERE ea.actividad_id = a.id) AS usos
       FROM actividades a ORDER BY a.orden, a.id`,
  );
  res.json({ items: rows });
});

actividadesRouter.use(requireRole('admin'));

const actividadSchema = z.object({
  nombre: texto('El nombre de la actividad', 150),
  categoria: textoOpcional(100),
  activa: z.boolean().default(true),
});

actividadesRouter.post('/', async (req, res) => {
  const d = validar(actividadSchema, req.body);
  const { rows } = await pool.query(
    `INSERT INTO actividades (orden, nombre, categoria, activa)
     VALUES ((SELECT COALESCE(max(orden), 0) + 1 FROM actividades), $1, $2, $3) RETURNING *`,
    [d.nombre, d.categoria, d.activa],
  );
  res.status(201).json({ actividad: rows[0] });
});

actividadesRouter.put('/orden', async (req, res) => {
  const d = validar(z.object({ ids: z.array(z.number().int().positive()).min(1) }), req.body);
  await tx(async (c) => {
    for (let i = 0; i < d.ids.length; i++) {
      await c.query('UPDATE actividades SET orden = $1 WHERE id = $2', [i + 1, d.ids[i]]);
    }
  });
  res.json({ ok: true });
});

actividadesRouter.put('/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const d = validar(actividadSchema, req.body);
  const { rows } = await pool.query(
    'UPDATE actividades SET nombre = $1, categoria = $2, activa = $3 WHERE id = $4 RETURNING *',
    [d.nombre, d.categoria, d.activa, id],
  );
  if (!rows[0]) throw new HttpError(404, 'Actividad no encontrada.');
  res.json({ actividad: rows[0] });
});

// Si la actividad ya se usó en algún equipo se desactiva (para conservar el historial);
// si nunca se usó, se elimina definitivamente.
actividadesRouter.delete('/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const usos = await pool.query('SELECT 1 FROM equipo_actividades WHERE actividad_id = $1 LIMIT 1', [id]);
  if (usos.rowCount) {
    await pool.query('UPDATE actividades SET activa = FALSE WHERE id = $1', [id]);
    res.json({ desactivada: true });
    return;
  }
  const r = await pool.query('DELETE FROM actividades WHERE id = $1', [id]);
  if (!r.rowCount) throw new HttpError(404, 'Actividad no encontrada.');
  res.json({ eliminada: true });
});
