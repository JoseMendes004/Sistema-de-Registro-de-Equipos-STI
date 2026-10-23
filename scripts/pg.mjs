// Utilidades para las copias de seguridad: localiza pg_dump/psql y arma la conexión desde DATABASE_URL.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** Ruta de una herramienta de PostgreSQL: la del PATH o la de la instalación de Windows. */
export function herramienta(nombre) {
  if (spawnSync(nombre, ['--version']).status === 0) return nombre;
  const base = process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'PostgreSQL') : '';
  if (base && existsSync(base)) {
    for (const v of readdirSync(base).sort((a, b) => Number(b) - Number(a))) {
      const exe = path.join(base, v, 'bin', `${nombre}.exe`);
      if (existsSync(exe)) return exe;
    }
  }
  console.error(`No se encontró ${nombre}. Instala PostgreSQL (incluye «Command Line Tools») o agrega su carpeta bin al PATH.`);
  process.exit(1);
}

/** DATABASE_URL en el formato que aceptan pg_dump y psql (sin parámetros propios de Node). */
export function urlConexion() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Falta DATABASE_URL en el archivo .env.');
    process.exit(1);
  }
  const u = new URL(url);
  const sslmode = u.searchParams.get('sslmode');
  u.search = sslmode ? `?sslmode=${sslmode}` : '';
  return u.toString();
}
