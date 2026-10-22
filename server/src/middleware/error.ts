import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  status: number;
  campos?: Record<string, string>;
  constructor(status: number, mensaje: string, campos?: Record<string, string>) {
    super(mensaje);
    this.status = status;
    this.campos = campos;
  }
}

export function noEncontrado(_req: Request, res: Response) {
  res.status(404).json({ error: 'Recurso no encontrado.' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function manejadorErrores(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, campos: err.campos });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido.' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
}
