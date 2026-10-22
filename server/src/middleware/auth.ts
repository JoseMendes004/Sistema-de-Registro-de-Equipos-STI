import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.ts';
import { pool } from '../db.ts';
import { HttpError } from './error.ts';

export const COOKIE = 'sti_sesion';
const DURACION_MS = 12 * 60 * 60 * 1000;

export interface Sesion {
  id: number;
  nombre: string;
  apellido: string;
  indicador: string;
  estacion: string;
  rol: 'admin' | 'analista';
}

export function iniciarSesion(res: Response, usuarioId: number) {
  const token = jwt.sign({}, config.jwtSecret, { subject: String(usuarioId), expiresIn: '12h' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.cookieSecure,
    maxAge: DURACION_MS,
    path: '/',
  });
}

export function cerrarSesion(res: Response) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'strict', secure: config.cookieSecure, path: '/' });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new HttpError(401, 'Debes iniciar sesión.');
  let sub: string | undefined;
  try {
    sub = (jwt.verify(token, config.jwtSecret) as jwt.JwtPayload).sub;
  } catch {
    throw new HttpError(401, 'La sesión expiró. Inicia sesión nuevamente.');
  }
  const { rows } = await pool.query<Sesion>(
    'SELECT id, nombre, apellido, indicador, estacion, rol FROM usuarios WHERE id = $1 AND eliminado_en IS NULL',
    [Number(sub)],
  );
  if (!rows[0]) {
    cerrarSesion(res);
    throw new HttpError(401, 'La cuenta ya no existe.');
  }
  res.locals.user = rows[0];
  next();
}

export function requireRole(rol: Sesion['rol']) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (usuarioDe(res).rol !== rol) throw new HttpError(403, 'No tienes permiso para realizar esta acción.');
    next();
  };
}

export const usuarioDe = (res: Response) => res.locals.user as Sesion;
