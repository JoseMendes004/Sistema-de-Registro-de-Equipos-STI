// Crea el administrador inicial (o convierte en administrador un indicador existente y le cambia la clave).
// Uso interactivo:  npm run create-admin
// Uso sin consola:  definir ADMIN_INDICADOR, ADMIN_CLAVE (y opcionalmente ADMIN_NOMBRE, ADMIN_APELLIDO, ADMIN_ESTACION)
import readline from 'node:readline';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.ts';

let oculto = false;
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
// Oculta lo que se teclea mientras se pide la clave.
(rl as any)._writeToOutput = (s: string) => {
  if (!oculto) process.stdout.write(s);
};

const preguntar = (texto: string, secreto = false) =>
  new Promise<string>((resolve) => {
    rl.question(texto, (r) => {
      if (secreto) process.stdout.write('\n');
      oculto = false;
      resolve(r.trim());
    });
    oculto = secreto;
  });

const env = process.env;
const interactivo = !(env.ADMIN_INDICADOR && env.ADMIN_CLAVE);
if (interactivo && !process.stdin.isTTY) {
  console.error('Sin consola interactiva: define ADMIN_INDICADOR y ADMIN_CLAVE.');
  process.exit(1);
}

const indicador = env.ADMIN_INDICADOR ?? (await preguntar('Indicador del administrador: '));
const nombre = env.ADMIN_NOMBRE ?? (interactivo ? await preguntar('Nombre (opcional): ') : 'Administrador');
const apellido = env.ADMIN_APELLIDO ?? (interactivo ? await preguntar('Apellido (opcional): ') : 'STI');
const estacion = env.ADMIN_ESTACION ?? (interactivo ? await preguntar('Estación de trabajo (opcional): ') : '1');
const clave = env.ADMIN_CLAVE ?? (await preguntar('Clave (mínimo 8 caracteres, no se muestra): ', true));
if (interactivo) {
  const repetir = await preguntar('Repite la clave: ', true);
  if (repetir !== clave) {
    console.error('Las claves no coinciden.');
    process.exit(1);
  }
}
rl.close();

if (!/^[A-Za-z0-9._-]{1,30}$/.test(indicador)) {
  console.error('Indicador inválido (solo letras, números, punto y guiones).');
  process.exit(1);
}
if (clave.length < 8 || clave.length > 72) {
  console.error('La clave debe tener entre 8 y 72 caracteres.');
  process.exit(1);
}

const hash = await bcrypt.hash(clave, 12);
const existe = await pool.query('SELECT id FROM usuarios WHERE lower(indicador) = lower($1) AND eliminado_en IS NULL', [indicador]);
if (existe.rows[0]) {
  await pool.query(`UPDATE usuarios SET clave_hash = $1, rol = 'admin' WHERE id = $2`, [
    hash,
    existe.rows[0].id,
  ]);
  console.log(`El usuario "${indicador}" ya existía: ahora es administrador y su clave fue actualizada.`);
} else {
  await pool.query(
    `INSERT INTO usuarios (nombre, apellido, indicador, estacion, clave_hash, rol) VALUES ($1, $2, $3, $4, $5, 'admin')`,
    [nombre, apellido, indicador, estacion, hash],
  );
  console.log(`Administrador "${indicador}" creado.`);
}
await pool.end();
