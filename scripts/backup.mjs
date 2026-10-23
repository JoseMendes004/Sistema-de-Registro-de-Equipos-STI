// Copia de seguridad: vuelca la base de datos a backups/sti_FECHA.sql
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { herramienta, urlConexion } from './pg.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);

const dir = path.join(root, 'backups');
mkdirSync(dir, { recursive: true });
const sello = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const destino = path.join(dir, `sti_${sello}.sql`);

const proc = spawn(herramienta('pg_dump'), [urlConexion(), '--clean', '--if-exists', '--no-owner'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
});
const salida = createWriteStream(destino);
proc.stdout.pipe(salida);

proc.on('error', (e) => {
  console.error('No se pudo ejecutar pg_dump:', e.message);
  process.exit(1);
});
proc.on('close', (code) => {
  salida.end(() => {
    if (code !== 0 || statSync(destino).size === 0) {
      unlinkSync(destino);
      console.error('La copia de seguridad falló. ¿Está PostgreSQL en marcha y es correcta la clave de DATABASE_URL?');
      process.exit(1);
    }
    console.log(`Copia de seguridad creada: ${destino} (${statSync(destino).size} bytes)`);
  });
});
