import { z } from 'zod';
import { HttpError } from './error.ts';

z.config(z.locales.es());

export function validar<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const campos: Record<string, string> = {};
    for (const i of r.error.issues) {
      const k = i.path.join('.') || '_';
      campos[k] ??= i.message;
    }
    throw new HttpError(400, 'Revisa los campos marcados.', campos);
  }
  return r.data;
}

/** Texto obligatorio, sin espacios sobrantes. */
export const texto = (etiqueta: string, max = 120) => {
  // "La etiqueta" → "Falta la etiqueta." (evita la concordancia de género de "obligatorio/a").
  const falta = `Falta ${etiqueta[0].toLowerCase()}${etiqueta.slice(1)}.`;
  return z
    .string({ error: falta })
    .trim()
    .min(1, falta)
    .max(max, `${etiqueta} no puede superar ${max} caracteres.`);
};

export const textoOpcional = (max = 120) =>
  z.string().trim().max(max, `Máximo ${max} caracteres.`).default('');

export function idParam(valor: unknown): number {
  const id = Number(valor);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'Recurso no encontrado.');
  return id;
}
