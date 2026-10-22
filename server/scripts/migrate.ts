// Aplica, en orden, las migraciones SQL pendientes de server/migrations.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, tx } from '../src/db.ts';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

await pool.query(
  `CREATE TABLE IF NOT EXISTS _migraciones (nombre TEXT PRIMARY KEY, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now())`,
);
const hechas = new Set((await pool.query('SELECT nombre FROM _migraciones')).rows.map((r) => r.nombre));

let aplicadas = 0;
for (const archivo of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  if (hechas.has(archivo)) continue;
  await tx(async (c) => {
    await c.query(fs.readFileSync(path.join(dir, archivo), 'utf8'));
    await c.query('INSERT INTO _migraciones (nombre) VALUES ($1)', [archivo]);
  });
  console.log('Migración aplicada:', archivo);
  aplicadas++;
}
console.log(aplicadas ? `Listo: ${aplicadas} migración(es) aplicada(s).` : 'La base de datos ya está al día.');
await pool.end();
