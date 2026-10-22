import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';
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

async function escribir(clave: string, valor: unknown) {
  await pool.query(
    `INSERT INTO configuracion (clave, valor) VALUES ($1, $2)
     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = now()`,
    [clave, JSON.stringify(valor)],
  );
}

export const temaRouter = Router();

// La paleta vigente es pública: también la necesita la pantalla de inicio de sesión.
temaRouter.get('/', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ tema: await leer('tema', TEMA_POR_DEFECTO) });
});

// Solo el administrador puede cambiar la paleta del sistema y administrar sus paletas guardadas.
temaRouter.put('/', requireAuth, requireRole('admin'), async (req, res) => {
  const tema = validar(temaSchema, req.body);
  await escribir('tema', tema);
  res.json({ tema });
});

temaRouter.get('/paletas', requireAuth, requireRole('admin'), async (_req, res) => {
  res.json({ paletas: await leer('paletas', []) });
});

temaRouter.put('/paletas', requireAuth, requireRole('admin'), async (req, res) => {
  const paletas = validar(paletasSchema, req.body?.paletas);
  await escribir('paletas', paletas);
  res.json({ paletas });
});
