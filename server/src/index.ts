import { app } from './app.ts';
import { config } from './config.ts';
import { pool } from './db.ts';

try {
  await pool.query('SELECT 1 FROM usuarios LIMIT 1');
} catch (e) {
  console.error('No se pudo usar la base de datos:', (e as Error).message);
  console.error('Comprueba que PostgreSQL esté en marcha, que DATABASE_URL del archivo .env sea correcta y que las migraciones estén aplicadas (npm run migrate).');
  process.exit(1);
}

app.listen(config.port, () => {
  console.log(`API STI escuchando en http://localhost:${config.port}`);
});
