import pg from 'pg';
import { config } from './config.ts';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  options: `-c timezone=${config.zonaHoraria}`,
});

export type Cliente = pg.PoolClient;

/** Ejecuta fn dentro de una transacción. */
export async function tx<T>(fn: (c: Cliente) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
