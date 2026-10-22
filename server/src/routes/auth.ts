import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.ts';
import { pool } from '../db.ts';
import { cerrarSesion, iniciarSesion, requireAuth, usuarioDe } from '../middleware/auth.ts';
import { HttpError } from '../middleware/error.ts';
import { texto, validar } from '../middleware/validate.ts';

export const authRouter = Router();

export const claveSchema = z
  .string({ error: 'La clave es obligatoria.' })
  .min(8, 'La clave debe tener al menos 8 caracteres.')
  .max(72, 'La clave no puede superar 72 caracteres.');

export const indicadorSchema = texto('El indicador', 30).regex(
  /^[A-Za-z0-9._-]+$/,
  'El indicador solo admite letras, números, punto, guion y guion bajo.',
);

const registroSchema = z
  .object({
    nombre: texto('El nombre', 60),
    apellido: texto('El apellido', 60),
    indicador: indicadorSchema,
    estacion: texto('La estación de trabajo', 60),
    clave: claveSchema,
    confirmacion: z.string({ error: 'Confirma la clave.' }),
  })
  .refine((d) => d.clave === d.confirmacion, {
    path: ['confirmacion'],
    message: 'La confirmación no coincide con la clave.',
  });

const limiteIntentos = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

const CAMPOS_SESION = 'id, nombre, apellido, indicador, estacion, rol';

authRouter.get('/config', (_req, res) => {
  res.json({ registro_abierto: config.registroAbierto });
});

authRouter.post('/registro', limiteIntentos, async (req, res) => {
  if (!config.registroAbierto) throw new HttpError(403, 'El registro de usuarios está deshabilitado.');
  const d = validar(registroSchema, req.body);
  const existe = await pool.query('SELECT 1 FROM usuarios WHERE lower(indicador) = lower($1) AND eliminado_en IS NULL', [d.indicador]);
  if (existe.rowCount) {
    throw new HttpError(409, 'Revisa los campos marcados.', { indicador: 'Ese indicador ya está registrado.' });
  }
  const hash = await bcrypt.hash(d.clave, 12);
  await pool.query(
    `INSERT INTO usuarios (nombre, apellido, indicador, estacion, clave_hash) VALUES ($1, $2, $3, $4, $5)`,
    [d.nombre, d.apellido, d.indicador, d.estacion, hash],
  );
  res.status(201).json({ ok: true });
});

authRouter.post('/login', limiteIntentos, async (req, res) => {
  const d = validar(
    z.object({ indicador: texto('El indicador', 30), clave: z.string({ error: 'La clave es obligatoria.' }).min(1, 'La clave es obligatoria.') }),
    req.body,
  );
  const { rows } = await pool.query(
    `SELECT ${CAMPOS_SESION}, clave_hash FROM usuarios WHERE lower(indicador) = lower($1) AND eliminado_en IS NULL`,
    [d.indicador],
  );
  const u = rows[0];
  const ok = u ? await bcrypt.compare(d.clave, u.clave_hash) : false;
  if (!ok) throw new HttpError(401, 'Indicador o clave incorrectos.');
  iniciarSesion(res, u.id);
  delete u.clave_hash;
  res.json({ usuario: u });
});

authRouter.post('/logout', (_req, res) => {
  cerrarSesion(res);
  res.json({ ok: true });
});

authRouter.get('/yo', requireAuth, (_req, res) => {
  res.json({ usuario: usuarioDe(res) });
});

authRouter.put('/clave', requireAuth, async (req, res) => {
  const d = validar(
    z
      .object({ actual: z.string().min(1, 'Escribe tu clave actual.'), nueva: claveSchema, confirmacion: z.string() })
      .refine((x) => x.nueva === x.confirmacion, {
        path: ['confirmacion'],
        message: 'La confirmación no coincide con la clave.',
      }),
    req.body,
  );
  const yo = usuarioDe(res);
  const { rows } = await pool.query('SELECT clave_hash FROM usuarios WHERE id = $1', [yo.id]);
  if (!(await bcrypt.compare(d.actual, rows[0].clave_hash))) {
    throw new HttpError(400, 'Revisa los campos marcados.', { actual: 'La clave actual no es correcta.' });
  }
  await pool.query('UPDATE usuarios SET clave_hash = $1 WHERE id = $2', [await bcrypt.hash(d.nueva, 12), yo.id]);
  res.json({ ok: true });
});
