// Genera el archivo .env con secretos aleatorios (no sobrescribe uno existente).
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');

if (existsSync(envPath)) {
  console.log('Ya existe un archivo .env; no se modificó.');
  process.exit(0);
}

const dbPass = randomBytes(18).toString('hex');
const jwt = randomBytes(48).toString('hex');

writeFileSync(
  envPath,
  `POSTGRES_USER=sti
POSTGRES_PASSWORD=${dbPass}
POSTGRES_DB=sti
POSTGRES_PORT=5433

DATABASE_URL=postgres://sti:${dbPass}@localhost:5433/sti
JWT_SECRET=${jwt}
API_PORT=4000
ZONA_HORARIA=America/Caracas
REGISTRO_ABIERTO=true
COOKIE_SECURE=false
`,
);
console.log('Archivo .env creado con secretos aleatorios.');
