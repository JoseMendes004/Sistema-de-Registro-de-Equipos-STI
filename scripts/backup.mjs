// Copia de seguridad: vuelca la base de datos del contenedor a backups/sti_FECHA.sql
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);

const user = process.env.POSTGRES_USER ?? 'sti';
const db = process.env.POSTGRES_DB ?? 'sti';

const dir = path.join(root, 'backups');
mkdirSync(dir, { recursive: true });
const sello = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const destino = path.join(dir, `sti_${sello}.sql`);

const proc = spawn(
  'docker',
  ['compose', 'exec', '-T', 'db', 'pg_dump', '-U', user, '-d', db, '--clean', '--if-exists', '--no-owner'],
  { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] },
);
const salida = createWriteStream(destino);
proc.stdout.pipe(salida);

proc.on('error', (e) => {
  console.error('No se pudo ejecutar docker:', e.message);
  process.exit(1);
});
proc.on('close', (code) => {
  salida.end(() => {
    if (code !== 0 || statSync(destino).size === 0) {
      unlinkSync(destino);
      console.error('La copia de seguridad falló. ¿Está el contenedor en marcha? (npm run db:up)');
      process.exit(1);
    }
    console.log(`Copia de seguridad creada: ${destino} (${statSync(destino).size} bytes)`);
  });
});
