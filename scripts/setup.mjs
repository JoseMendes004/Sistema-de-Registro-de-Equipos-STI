// Genera el archivo .env con secretos aleatorios (no sobrescribe uno existente).
// Usa la base `sti` del PostgreSQL instalado en este equipo (usuario `sti`, puerto 5432).
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');

if (existsSync(envPath)) {
  console.log('Ya existe un archivo .env; no se modificó.');
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const clave = (await rl.question('Clave del usuario «sti» de PostgreSQL: ')).trim();
rl.close();
if (!clave) {
  console.error('Hace falta la clave para armar DATABASE_URL.');
  process.exit(1);
}

const jwt = randomBytes(48).toString('hex');
writeFileSync(
  envPath,
  `DATABASE_URL=postgres://sti:${encodeURIComponent(clave)}@localhost:5432/sti
JWT_SECRET=${jwt}
API_PORT=4000
ZONA_HORARIA=America/Caracas
REGISTRO_ABIERTO=true
COOKIE_SECURE=false
`,
);
console.log('Archivo .env creado con secretos aleatorios.');
