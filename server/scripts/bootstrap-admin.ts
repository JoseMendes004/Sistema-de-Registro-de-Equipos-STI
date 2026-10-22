// Crea el primer administrador al arrancar, si todavía no existe ninguno y se definieron
// ADMIN_INDICADOR y ADMIN_CLAVE (por ejemplo, como variables de entorno en Render, donde no hay terminal gratuita).
// Después de iniciar sesión por primera vez conviene borrar ADMIN_CLAVE de las variables de entorno.
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.ts';

const indicador = process.env.ADMIN_INDICADOR?.trim();
const clave = process.env.ADMIN_CLAVE;

try {
  if (!indicador || !clave) {
    console.log('Sin ADMIN_INDICADOR/ADMIN_CLAVE: no se crea administrador inicial.');
  } else {
    const hay = await pool.query(`SELECT 1 FROM usuarios WHERE rol = 'admin' AND eliminado_en IS NULL LIMIT 1`);
    if (hay.rowCount) {
      console.log('Ya existe un administrador: no se crea otro.');
    } else if (!/^[A-Za-z0-9._-]{1,30}$/.test(indicador) || clave.length < 8 || clave.length > 72) {
      console.error('ADMIN_INDICADOR inválido o ADMIN_CLAVE fuera de 8–72 caracteres: no se creó el administrador.');
    } else {
      await pool.query(
        `INSERT INTO usuarios (nombre, apellido, indicador, estacion, clave_hash, rol) VALUES ($1, $2, $3, $4, $5, 'admin')`,
        [
          process.env.ADMIN_NOMBRE?.trim() || 'Administrador',
          process.env.ADMIN_APELLIDO?.trim() || 'STI',
          indicador,
          process.env.ADMIN_ESTACION?.trim() || '1',
          await bcrypt.hash(clave, 12),
        ],
      );
      console.log(`Administrador inicial «${indicador}» creado.`);
    }
  }
} finally {
  await pool.end();
}
