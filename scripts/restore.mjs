// Restaura una copia de seguridad: npm run restore -- backups/sti_FECHA.sql
// ATENCIÓN: reemplaza los datos actuales por los del archivo.
import { spawn } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);

const archivo = process.argv[2] ? path.resolve(process.argv[2]) : '';
if (!archivo || !existsSync(archivo)) {
  console.error('Uso: npm run restore -- backups/sti_FECHA.sql');
  process.exit(1);
}

const user = process.env.POSTGRES_USER ?? 'sti';
const db = process.env.POSTGRES_DB ?? 'sti';

const proc = spawn(
  'docker',
  ['compose', 'exec', '-T', 'db', 'psql', '-U', user, '-d', db, '-v', 'ON_ERROR_STOP=1', '-q'],
  { cwd: root, stdio: ['pipe', 'inherit', 'inherit'] },
);
createReadStream(archivo).pipe(proc.stdin);
proc.on('close', (code) => {
  if (code !== 0) {
    console.error('La restauración falló.');
    process.exit(1);
  }
  console.log('Base de datos restaurada desde', archivo);
});
