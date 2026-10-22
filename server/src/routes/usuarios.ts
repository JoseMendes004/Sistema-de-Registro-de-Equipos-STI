import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.ts';
import { requireRole, usuarioDe } from '../middleware/auth.ts';
import { HttpError } from '../middleware/error.ts';
import { idParam, texto, validar } from '../middleware/validate.ts';
import { claveSchema } from './auth.ts';

export const usuariosRouter = Router();

// Lista reducida para los filtros (disponible para cualquier usuario autenticado).
usuariosRouter.get('/analistas', async (_req, res) => {
  const [analistas, estaciones] = await Promise.all([
    pool.query(`SELECT id, nombre || ' ' || apellido AS nombre FROM usuarios ORDER BY nombre, apellido`),
    pool.query(
      `SELECT estacion FROM (SELECT estacion FROM equipos UNION SELECT estacion FROM usuarios) t ORDER BY estacion`,
    ),
  ]);
  res.json({ analistas: analistas.rows, estaciones: estaciones.rows.map((r) => r.estacion) });
});

usuariosRouter.use(requireRole('admin'));

usuariosRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre, u.apellido, u.indicador, u.estacion, u.rol, u.creado_en,
            (SELECT count(*)::int FROM equipos e WHERE e.analista_id = u.id) AS equipos
       FROM usuarios u WHERE u.eliminado_en IS NULL ORDER BY u.nombre, u.apellido`,
  );
  res.json({ items: rows });
});

usuariosRouter.put('/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const d = validar(
    z.object({
      nombre: texto('El nombre', 60),
      apellido: texto('El apellido', 60),
      estacion: texto('La estación de trabajo', 60),
      rol: z.enum(['admin', 'analista']),
    }),
    req.body,
  );
  if (id === usuarioDe(res).id && d.rol !== 'admin') {
    throw new HttpError(400, 'No puedes quitarte tu propio rol de administrador.');
  }
  const { rows } = await pool.query(
    `UPDATE usuarios SET nombre = $1, apellido = $2, estacion = $3, rol = $4 WHERE id = $5 AND eliminado_en IS NULL
     RETURNING id, nombre, apellido, indicador, estacion, rol`,
    [d.nombre, d.apellido, d.estacion, d.rol, id],
  );
  if (!rows[0]) throw new HttpError(404, 'Usuario no encontrado.');
  res.json({ usuario: rows[0] });
});

usuariosRouter.put('/:id/clave', async (req, res) => {
  const id = idParam(req.params.id);
  const d = validar(z.object({ clave: claveSchema }), req.body);
  const r = await pool.query('UPDATE usuarios SET clave_hash = $1 WHERE id = $2 AND eliminado_en IS NULL', [await bcrypt.hash(d.clave, 12), id]);
  if (!r.rowCount) throw new HttpError(404, 'Usuario no encontrado.');
  res.json({ ok: true });
});

// Elimina al usuario previa confirmación con la clave del administrador.
// Sus equipos y movimientos se conservan con su nombre: la fila se marca como eliminada
// (sin clave, fuera de las listas y sin poder iniciar sesión) en lugar de borrarse.
usuariosRouter.delete('/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const yo = usuarioDe(res);
  if (id === yo.id) throw new HttpError(400, 'No puedes eliminar tu propia cuenta.');
  const d = validar(z.object({ clave: z.string().min(1, 'Escribe tu clave de administrador.') }), req.body);
  const { rows } = await pool.query('SELECT clave_hash FROM usuarios WHERE id = $1', [yo.id]);
  if (!(await bcrypt.compare(d.clave, rows[0].clave_hash))) {
    throw new HttpError(400, 'Revisa los campos marcados.', { clave: 'La clave no es correcta.' });
  }
  const r = await pool.query(
    `UPDATE usuarios SET eliminado_en = now(), clave_hash = '!' WHERE id = $1 AND eliminado_en IS NULL`,
    [id],
  );
  if (!r.rowCount) throw new HttpError(404, 'Usuario no encontrado.');
  res.json({ ok: true });
});
