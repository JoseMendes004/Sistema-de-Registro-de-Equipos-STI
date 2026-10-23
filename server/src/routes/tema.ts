import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.ts';
import { requireAuth, usuarioDe } from '../middleware/auth.ts';
import { validar } from '../middleware/validate.ts';

const TEMA_POR_DEFECTO = { h: 355, s: 1, fondo: '#1f1c1c' };

const temaSchema = z.object({
  h: z.number().min(0).max(360),
  s: z.number().min(0).max(1),
  fondo: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color de fondo inválido.'),
});
const paletasSchema = z
  .array(temaSchema.extend({ id: z.string().min(1).max(40), nombre: z.string().trim().min(1).max(24) }))
  .max(12);

async function leer<T>(clave: string, porDefecto: T): Promise<T> {
  const { rows } = await pool.query('SELECT valor FROM configuracion WHERE clave = $1', [clave]);
  return (rows[0]?.valor as T) ?? porDefecto;
}

export const temaRouter = Router();

// La paleta del sistema es pública (la necesita la pantalla de inicio de sesión) y es la de quien aún no eligió una.
temaRouter.get('/', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ tema: await leer('tema', TEMA_POR_DEFECTO) });
});

// Cada usuario tiene su propia paleta y sus paletas guardadas; sin elegir, ve la paleta del sistema.
temaRouter.get('/mio', requireAuth, async (_req, res) => {
  const { rows } = await pool.query('SELECT tema FROM usuarios WHERE id = $1', [usuarioDe(res).id]);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ tema: rows[0]?.tema ?? (await leer('tema', TEMA_POR_DEFECTO)) });
});

temaRouter.put('/mio', requireAuth, async (req, res) => {
  const tema = validar(temaSchema, req.body);
  await pool.query('UPDATE usuarios SET tema = $1 WHERE id = $2', [JSON.stringify(tema), usuarioDe(res).id]);
  res.json({ tema });
});

temaRouter.get('/paletas', requireAuth, async (_req, res) => {
  const { rows } = await pool.query('SELECT paletas FROM usuarios WHERE id = $1', [usuarioDe(res).id]);
  res.json({ paletas: rows[0]?.paletas ?? [] });
});

temaRouter.put('/paletas', requireAuth, async (req, res) => {
  const paletas = validar(paletasSchema, req.body?.paletas);
  await pool.query('UPDATE usuarios SET paletas = $1 WHERE id = $2', [JSON.stringify(paletas), usuarioDe(res).id]);
  res.json({ paletas });
});
