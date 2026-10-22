export class ApiError extends Error {
  status: number;
  campos: Record<string, string>;
  constructor(status: number, mensaje: string, campos: Record<string, string> = {}) {
    super(mensaje);
    this.status = status;
    this.campos = campos;
  }
}

let alExpirar: (() => void) | null = null;
export const alExpirarSesion = (fn: () => void) => {
  alExpirar = fn;
};

export async function api<T>(ruta: string, opciones: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${ruta}`, {
      method: opciones.method ?? 'GET',
      credentials: 'same-origin',
      headers: opciones.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !ruta.startsWith('/auth/')) alExpirar?.();
    throw new ApiError(
      res.status,
      data?.error ?? (res.status >= 500 ? 'El servidor no está disponible.' : 'Error inesperado.'),
      data?.campos,
    );
  }
  return data as T;
}

export const mensajeError = (e: unknown) => (e instanceof Error ? e.message : 'Error inesperado.');
export const camposError = (e: unknown) => (e instanceof ApiError ? e.campos : {});

/** Construye un query string omitiendo los valores vacíos. */
export function qs(params: Record<string, string | number | undefined | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Envía un archivo tal cual (binario) al servidor y devuelve la respuesta JSON. */
export async function apiArchivo<T>(ruta: string, archivo: File): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${ruta}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: await archivo.arrayBuffer(),
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) alExpirar?.();
    throw new ApiError(res.status, data?.error ?? (res.status === 413 ? 'El archivo es demasiado grande (máximo 5 MB).' : 'Error inesperado.'), data?.campos);
  }
  return data as T;
}
