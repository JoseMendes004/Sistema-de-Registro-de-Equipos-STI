// Carga datos de prueba: 4 analistas y 12 equipos en distintos estados.
// Solo se ejecuta si todavía no hay equipos registrados.
// La clave de los analistas de prueba se toma de SEED_CLAVE; si no existe, se genera una aleatoria.
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool, tx } from '../src/db.ts';
import { registrarCambioEstado, registrarHistorial } from '../src/services/equipos.service.ts';

if ((await pool.query('SELECT count(*)::int AS n FROM equipos')).rows[0].n > 0) {
  console.log('Ya hay equipos registrados; no se cargaron datos de prueba.');
  await pool.end();
  process.exit(0);
}

const clave = process.env.SEED_CLAVE ?? randomBytes(6).toString('base64url');
const hash = await bcrypt.hash(clave, 12);

const ANALISTAS = [
  ['José', 'Mendes', 'mendesj', '6'],
  ['Ana', 'Torres', 'torresa', '3'],
  ['Luis', 'Gómez', 'gomezl', '5'],
  ['Pedro', 'Rojas', 'rojasp', '2'],
];

// [propietario, etiqueta, modelo, mac, nombre, analista, disco, capacidad, ram, estado, actividades hechas, días atrás]
const EQUIPOS: [string, string, string, string, string, number, string, string, string, string, number, number][] = [
  ['Guerrerodb', '28012545', 'Lenovo 8910', '00-34-7E-0F-E8-38', 'DEPAREF0FE838', 0, 'SSD', '256 GB', '8 GB', 'En proceso', 12, 11],
  ['María López', '28012546', 'HP ProBook 450', 'A4-5E-60-1B-2C-3D', 'HP450-2C3D', 1, 'HDD', '500 GB', '8 GB', 'En revisión', 8, 11],
  ['Carlos Ruiz', '28012547', 'Dell Inspiron 15', 'F0-1F-BA-66-77-88', 'DELL-7788', 2, 'SSD', '512 GB', '16 GB', 'Listo para entregar', 17, 10],
  ['Ana García', '28012548', 'Asus VivoBook', '3C-97-0E-4F-6A-12', 'ASUS-6A12', 3, 'SSD', '1 TB', '16 GB', 'Entregado', 19, 10],
  ['Luis Fernández', '28012549', 'Lenovo ThinkPad', '00-24-7B-9C-DD-EE', 'LENOVO-DDEE', 0, 'HDD', '1 TB', '8 GB', 'Pendiente', 5, 9],
  ['Sofía Martínez', '28012550', 'Acer Aspire 5', 'B8-27-EB-11-22-33', 'ACER-2233', 1, 'SSD', '256 GB', '8 GB', 'En proceso', 10, 9],
  ['Pedro Silva', '28012551', 'HP EliteBook', 'F4-6D-04-55-66-77', 'HP-6677', 2, 'SSD', '512 GB', '16 GB', 'Listo para entregar', 19, 8],
  ['Valentina Torres', '28012552', 'Dell Latitude', '9A-F3-2B-11-22-33', 'DELL-2233', 3, 'HDD', '500 GB', '4 GB', 'Recibido', 3, 7],
  ['Jorge Castillo', '28012553', 'Toshiba Satellite', 'C0-18-7E-9F-AA-BB', 'TOSHIBA-AABB', 1, 'SSD', '256 GB', '8 GB', 'En revisión', 6, 6],
  ['Elena Vargas', '28012554', 'Lenovo ThinkCentre', 'C4-12-34-56-78-9A', 'LENOVO-789A', 2, 'SSD', '512 GB', '16 GB', 'En proceso', 9, 5],
  ['Ramón Díaz', '28012555', 'HP ProDesk 400', '10-62-E5-AB-CD-EF', 'HP-CDEF', 0, 'HDD', '1 TB', '8 GB', 'Entregado', 19, 4],
  ['Carmen Peña', '28012556', 'Dell OptiPlex 7010', '18-66-DA-01-02-03', 'DELL-0203', 3, 'NO_ESPECIFICADO', '', '4 GB', 'Recibido', 0, 1],
];

const HORA = 60 * 60 * 1000;

await tx(async (c) => {
  const ids: number[] = [];
  const estaciones: string[] = [];
  for (const [nombre, apellido, indicador, estacion] of ANALISTAS) {
    const { rows } = await c.query(
      `INSERT INTO usuarios (nombre, apellido, indicador, estacion, clave_hash) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (lower(indicador)) WHERE eliminado_en IS NULL DO UPDATE SET indicador = EXCLUDED.indicador RETURNING id, estacion`,
      [nombre, apellido, indicador, estacion, hash],
    );
    ids.push(rows[0].id);
    estaciones.push(rows[0].estacion);
  }
  const actividades = (await c.query('SELECT id, nombre FROM actividades WHERE activa ORDER BY orden')).rows;

  for (const [prop, etiqueta, modelo, mac, nombreEq, a, disco, cap, ram, estado, hechas, dias] of EQUIPOS) {
    const ingreso = new Date(Date.now() - dias * 24 * HORA);
    const analista = ids[a];
    const { rows } = await c.query(
      `INSERT INTO equipos (fecha_ingreso, usuario_propietario, etiqueta, modelo, mac, nombre_equipo, analista_id,
                            estacion, tipo_disco, capacidad_disco, ram, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [ingreso, prop, etiqueta, modelo, mac, nombreEq, analista, estaciones[a], disco, cap, ram, estado],
    );
    const id = rows[0].id;
    await registrarHistorial(c, id, analista, 'INGRESO', 'Equipo ingresado al laboratorio', {}, ingreso);
    await registrarCambioEstado(c, id, analista, null, 'Recibido', ingreso);

    let momento = ingreso.getTime();
    for (const act of actividades.slice(0, hechas)) {
      momento += HORA / 2;
      const f = new Date(momento);
      await c.query(
        `INSERT INTO equipo_actividades (equipo_id, actividad_id, completada, completada_en, analista_id)
         VALUES ($1, $2, TRUE, $3, $4)`,
        [id, act.id, f, analista],
      );
      await registrarHistorial(c, id, analista, 'ACTIVIDAD', `Actividad completada: ${act.nombre}`, {}, f);
    }
    if (estado !== 'Recibido') {
      const previo = estado === 'Entregado' ? 'Listo para entregar' : estado;
      const f = new Date(momento + HORA / 4);
      await registrarCambioEstado(c, id, analista, 'Recibido', previo, f);
      await registrarHistorial(c, id, analista, 'ESTADO', `Estado: Recibido → ${previo}`, {}, f);
    }
    if (estado === 'Entregado') {
      const f = new Date(momento + HORA);
      await c.query(
        `INSERT INTO salidas (equipo_id, fecha_salida, retirado_por, observaciones, analista_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, f, prop, 'Equipo entregado conforme.', analista],
      );
      await c.query('UPDATE equipos SET cerrado_en = $2 WHERE id = $1', [id, f]);
      await registrarCambioEstado(c, id, analista, 'Listo para entregar', 'Entregado', f);
      await registrarHistorial(c, id, analista, 'SALIDA', `Equipo entregado a ${prop}`, {}, f);
    }
  }
});

console.log(`Datos de prueba cargados: ${ANALISTAS.length} analistas y ${EQUIPOS.length} equipos.`);
console.log(`Analistas de prueba: ${ANALISTAS.map((a) => a[2]).join(', ')}`);
console.log(process.env.SEED_CLAVE ? 'Clave: la definida en SEED_CLAVE.' : `Clave generada para todos ellos: ${clave}`);
await pool.end();
