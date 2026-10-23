import express, { Router } from 'express';
import ExcelJS from 'exceljs';
import { pool, tx } from '../db.ts';
import { requireRole, usuarioDe } from '../middleware/auth.ts';
import type { Sesion } from '../middleware/auth.ts';
import { HttpError } from '../middleware/error.ts';
import { ESTADOS, registrarCambioEstado, registrarHistorial } from '../services/equipos.service.ts';

export const importarRouter = Router();
importarRouter.use(requireRole('admin'));

const MAX_FILAS = 1000;
const MAC_RE = /^[0-9A-Fa-f]{2}([-:.]?[0-9A-Fa-f]{2}){5}$/;
const crudo = express.raw({ type: () => true, limit: '5mb' });

type Campo =
  | 'usuario_propietario'
  | 'etiqueta'
  | 'modelo'
  | 'mac'
  | 'nombre_equipo'
  | 'analista'
  | 'estacion'
  | 'tipo_disco'
  | 'capacidad_disco'
  | 'ram'
  | 'estado'
  | 'fecha_ingreso'
  | 'fecha_salida'
  | 'retirado_por'
  | 'observaciones';

const OBLIGATORIOS: { campo: Campo; titulo: string }[] = [
  { campo: 'usuario_propietario', titulo: 'Usuario' },
  { campo: 'etiqueta', titulo: 'Etiqueta' },
  { campo: 'modelo', titulo: 'Modelo' },
  { campo: 'mac', titulo: 'MAC' },
  { campo: 'nombre_equipo', titulo: 'Nombre del equipo' },
];

// Nombres de columna aceptados (sin tildes, mayúsculas ni signos). Las columnas desconocidas se ignoran.
const ALIAS: Record<Campo, string[]> = {
  usuario_propietario: ['usuario', 'usuariopropietario', 'propietario', 'cliente'],
  etiqueta: ['etiqueta'],
  modelo: ['modelo', 'equipo', 'equipomodelo'],
  mac: ['mac', 'direccionmac'],
  nombre_equipo: ['nombredelequipo', 'nombreequipo', 'nombre'],
  analista: ['analista', 'analistaindicador', 'indicador'],
  estacion: ['estacion', 'estaciondetrabajo'],
  tipo_disco: ['tipodedisco', 'tipodisco', 'disco'],
  capacidad_disco: ['capacidad', 'capacidaddisco', 'capacidaddeldisco'],
  ram: ['ram', 'memoriaram', 'memoria', 'cuantaram'],
  estado: ['estado'],
  fecha_ingreso: ['fechaingreso', 'fechadeingreso', 'fecha'],
  fecha_salida: ['fechasalida', 'fechadesalida'],
  retirado_por: ['retiradopor', 'retira', 'personaqueretira'],
  observaciones: ['observaciones', 'observacion', 'notas'],
};

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

function campoDeEncabezado(titulo: string): Campo | null {
  const n = norm(titulo);
  if (!n) return null;
  for (const [campo, lista] of Object.entries(ALIAS) as [Campo, string[]][]) if (lista.includes(n)) return campo;
  // «Disco (duros, sólidos o ssd)» y similares
  if (n.startsWith('disco')) return 'tipo_disco';
  return null;
}

type Valor = string | number | boolean | Date | null;

function valorCelda(v: ExcelJS.CellValue): Valor {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return valorCelda(v.result as ExcelJS.CellValue);
    if ('text' in v) return String(v.text);
    return null;
  }
  return v;
}

const texto = (v: Valor) => (v == null || v instanceof Date ? '' : String(v).trim());

/** Fecha de Excel (sin zona horaria) → fecha local; si solo trae el día, se usa las 08:00. */
function desdeComponentes(y: number, mo: number, d: number, h: number | null, mi: number) {
  const f = new Date(y, mo, d, h ?? 8, mi);
  return f.getFullYear() === y && f.getMonth() === mo && f.getDate() === d ? f : null;
}

function aFecha(v: Valor): Date | null | 'invalida' {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return 'invalida';
    const conHora = v.getUTCHours() || v.getUTCMinutes();
    return desdeComponentes(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate(), conHora ? v.getUTCHours() : null, v.getUTCMinutes()) ?? 'invalida';
  }
  if (typeof v === 'number') return aFecha(new Date(Math.round((v - 25569) * 86400 * 1000)));
  const t = String(v).trim();
  let m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return desdeComponentes(y, Number(m[2]) - 1, Number(m[1]), m[4] ? Number(m[4]) : null, m[5] ? Number(m[5]) : 0) ?? 'invalida';
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return desdeComponentes(Number(m[1]), Number(m[2]) - 1, Number(m[3]), m[4] ? Number(m[4]) : null, m[5] ? Number(m[5]) : 0) ?? 'invalida';
  return 'invalida';
}

function tipoDisco(t: string) {
  const n = norm(t);
  if (!n) return 'NO_ESPECIFICADO';
  if (n.includes('ssd') || n.includes('solid')) return 'SSD';
  if (n.includes('hdd') || n.includes('duro')) return 'HDD';
  if (n.includes('otro')) return 'OTRO';
  return 'NO_ESPECIFICADO';
}

/** Un número suelto (8) se entiende como GB. */
const conUnidad = (v: Valor) => (typeof v === 'number' ? `${v} GB` : texto(v));

interface FilaValida {
  usuario_propietario: string;
  etiqueta: string;
  modelo: string;
  mac: string;
  nombre_equipo: string;
  analista_id: number;
  analista: string;
  estacion: string;
  tipo_disco: string;
  capacidad_disco: string;
  ram: string;
  estado: string;
  observaciones: string;
  fecha_ingreso: Date;
  fecha_salida: Date | null;
  retirado_por: string;
}

interface ResultadoFila {
  fila: number;
  errores: string[];
  vista: Record<string, string>;
  datos: FilaValida | null;
}

interface Analisis {
  filas: ResultadoFila[];
  ignoradas: string[];
}

async function analizar(buffer: Buffer, admin: Sesion): Promise<Analisis> {
  if (!buffer?.length) throw new HttpError(400, 'No se recibió ningún archivo.');
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new HttpError(400, 'El archivo no es un Excel (.xlsx) válido.');
  }
  const hoja = wb.worksheets.find((w) => norm(w.name) !== 'instrucciones') ?? wb.worksheets[0];
  if (!hoja) throw new HttpError(400, 'El Excel no tiene hojas.');

  const columnas = new Map<Campo, number>();
  const ignoradas: string[] = [];
  hoja.getRow(1).eachCell({ includeEmpty: false }, (celda, col) => {
    const titulo = texto(valorCelda(celda.value));
    const campo = campoDeEncabezado(titulo);
    if (campo && !columnas.has(campo)) columnas.set(campo, col);
    else if (titulo) ignoradas.push(titulo);
  });
  const faltan = OBLIGATORIOS.filter((o) => !columnas.has(o.campo)).map((o) => o.titulo);
  if (faltan.length) {
    throw new HttpError(
      400,
      `Faltan columnas obligatorias en la primera fila: ${faltan.join(', ')}. Descarga la plantilla para ver el formato.`,
    );
  }
  if (hoja.rowCount - 1 > MAX_FILAS) throw new HttpError(400, `El archivo supera el máximo de ${MAX_FILAS} filas por carga.`);

  const [usuarios, existentes] = await Promise.all([
    pool.query('SELECT id, nombre, apellido, indicador, estacion FROM usuarios WHERE eliminado_en IS NULL'),
    pool.query('SELECT lower(etiqueta) AS e FROM equipos'),
  ]);
  const porClave = new Map<string, { id: number; nombre: string; estacion: string }>();
  const ambiguos = new Set<string>(); // nombres que coinciden con más de un usuario
  for (const u of usuarios.rows) {
    const nombre = `${u.nombre} ${u.apellido}`;
    const datos = { id: u.id, nombre, estacion: u.estacion };
    porClave.set(norm(u.indicador), datos);
    const k = norm(nombre);
    if (porClave.has(k) && porClave.get(k)!.id !== u.id) ambiguos.add(k);
    else porClave.set(k, datos);
  }
  const etiquetasUsadas = new Set<string>(existentes.rows.map((r) => r.e));

  const filas: ResultadoFila[] = [];
  for (let n = 2; n <= hoja.rowCount; n++) {
    const fila = hoja.getRow(n);
    const v = (campo: Campo): Valor => {
      const col = columnas.get(campo);
      return col ? valorCelda(fila.getCell(col).value) : null;
    };
    const t = (campo: Campo) => texto(v(campo));
    // se saltan las filas totalmente vacías
    if ([...columnas.keys()].every((c) => v(c) == null || texto(v(c)) === '')) continue;

    const errores: string[] = [];
    for (const o of OBLIGATORIOS) if (!t(o.campo)) errores.push(`Falta ${o.titulo.toLowerCase()}.`);

    let mac = t('mac');
    if (mac) {
      if (!MAC_RE.test(mac)) errores.push('MAC inválida (formato 00-34-7E-0F-E8-38).');
      else mac = mac.replace(/[^0-9A-Fa-f]/g, '').toUpperCase().match(/.{2}/g)!.join('-');
    }

    const etiqueta = t('etiqueta');
    if (etiqueta) {
      const clave = etiqueta.toLowerCase();
      if (etiquetasUsadas.has(clave)) errores.push(`La etiqueta ${etiqueta} ya existe o está repetida en el archivo.`);
      else etiquetasUsadas.add(clave);
    }

    let analista = { id: admin.id, nombre: `${admin.nombre} ${admin.apellido}`, estacion: admin.estacion };
    const analistaTexto = t('analista');
    if (analistaTexto) {
      const u = porClave.get(norm(analistaTexto));
      if (ambiguos.has(norm(analistaTexto))) errores.push(`«${analistaTexto}» coincide con más de un usuario: escribe su indicador.`);
      else if (u) analista = u;
      else errores.push(`El analista «${analistaTexto}» no existe (usa su indicador o su nombre completo).`);
    }

    let estado = t('estado') || 'Recibido';
    const estadoValido = ESTADOS.find((e) => norm(e) === norm(estado));
    if (!estadoValido) errores.push(`Estado «${estado}» no válido (${ESTADOS.join(', ')}).`);
    else estado = estadoValido;

    let ingreso = aFecha(v('fecha_ingreso'));
    if (ingreso === 'invalida') {
      errores.push('Fecha de ingreso inválida (usa dd/mm/aaaa).');
      ingreso = null;
    }
    let salida = aFecha(v('fecha_salida'));
    if (salida === 'invalida') {
      errores.push('Fecha de salida inválida (usa dd/mm/aaaa).');
      salida = null;
    }
    const retira = t('retirado_por');
    if (estado === 'Entregado') {
      if (!salida) errores.push('Un equipo «Entregado» necesita fecha de salida.');
      if (!retira) errores.push('Un equipo «Entregado» necesita «Retirado por».');
    }
    const fechaIngreso = ingreso ?? new Date();
    if (salida && salida < fechaIngreso) errores.push('La fecha de salida es anterior a la de ingreso.');
    if (fechaIngreso.getTime() > Date.now() + 24 * 3600 * 1000) errores.push('La fecha de ingreso está en el futuro.');

    const datos: FilaValida = {
      usuario_propietario: t('usuario_propietario').slice(0, 120),
      etiqueta: etiqueta.slice(0, 60),
      modelo: t('modelo').slice(0, 120),
      mac,
      nombre_equipo: t('nombre_equipo').slice(0, 120),
      analista_id: analista.id,
      analista: analista.nombre,
      estacion: (t('estacion') || analista.estacion).slice(0, 60),
      tipo_disco: tipoDisco(t('tipo_disco')),
      capacidad_disco: conUnidad(v('capacidad_disco')).slice(0, 30),
      ram: conUnidad(v('ram')).slice(0, 30),
      estado,
      observaciones: t('observaciones').slice(0, 2000),
      fecha_ingreso: fechaIngreso,
      fecha_salida: salida,
      retirado_por: retira.slice(0, 120),
    };
    filas.push({
      fila: n,
      errores,
      datos: errores.length ? null : datos,
      vista: {
        usuario: datos.usuario_propietario,
        etiqueta: datos.etiqueta,
        modelo: datos.modelo,
        mac: datos.mac || t('mac'),
        nombre: datos.nombre_equipo,
        analista: datos.analista,
        estado: datos.estado,
      },
    });
  }
  if (!filas.length) throw new HttpError(400, 'El Excel no tiene filas de datos debajo de los encabezados.');
  return { filas, ignoradas };
}

importarRouter.post('/vista-previa', crudo, async (req, res) => {
  const { filas, ignoradas } = await analizar(req.body as Buffer, usuarioDe(res));
  const validas = filas.filter((f) => f.datos).length;
  res.json({
    total: filas.length,
    validas,
    con_errores: filas.length - validas,
    ignoradas,
    filas: filas.map(({ fila, errores, vista }) => ({ fila, errores, vista })),
  });
});

importarRouter.post('/confirmar', crudo, async (req, res) => {
  const admin = usuarioDe(res);
  const { filas } = await analizar(req.body as Buffer, admin);
  const validas = filas.filter((f) => f.datos);
  if (!validas.length) throw new HttpError(400, 'No hay filas válidas para importar.');

  await tx(async (c) => {
    for (const { datos: d } of validas) {
      const { rows } = await c.query(
        `INSERT INTO equipos (fecha_ingreso, usuario_propietario, etiqueta, modelo, mac, nombre_equipo, analista_id,
                              estacion, tipo_disco, capacidad_disco, ram, estado, observaciones)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
        [d!.fecha_ingreso, d!.usuario_propietario, d!.etiqueta, d!.modelo, d!.mac, d!.nombre_equipo, d!.analista_id,
         d!.estacion, d!.tipo_disco, d!.capacidad_disco, d!.ram, d!.estado, d!.observaciones],
      );
      const id = rows[0].id as number;
      await registrarHistorial(c, id, admin.id, 'INGRESO', 'Equipo importado desde Excel', { importado: true }, d!.fecha_ingreso);
      await registrarCambioEstado(c, id, d!.analista_id, null, 'Recibido', d!.fecha_ingreso);
      if (d!.estado !== 'Recibido') {
        await registrarCambioEstado(c, id, d!.analista_id, 'Recibido', d!.estado, d!.fecha_salida ?? d!.fecha_ingreso);
        await registrarHistorial(c, id, admin.id, 'ESTADO', `Estado: Recibido → ${d!.estado}`, { importado: true }, d!.fecha_salida ?? d!.fecha_ingreso);
      }
      if (d!.estado === 'Entregado' && d!.fecha_salida) {
        await c.query(
          `INSERT INTO salidas (equipo_id, fecha_salida, retirado_por, observaciones, analista_id) VALUES ($1, $2, $3, '', $4)`,
          [id, d!.fecha_salida, d!.retirado_por, d!.analista_id],
        );
        // Un equipo importado como «Entregado» llega con el caso ya cerrado.
        await c.query('UPDATE equipos SET cerrado_en = $2 WHERE id = $1', [id, d!.fecha_salida]);
        await registrarHistorial(c, id, admin.id, 'SALIDA', `Equipo entregado a ${d!.retirado_por}`, { importado: true }, d!.fecha_salida);
      }
    }
  });
  res.status(201).json({ creados: validas.length, omitidos: filas.length - validas.length });
});

importarRouter.get('/plantilla', async (_req, res) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Registro de Equipos — STI';
  const hoja = wb.addWorksheet('Equipos');
  const columnas: [string, number][] = [
    ['Usuario', 22],
    ['Etiqueta', 14],
    ['Modelo', 22],
    ['MAC', 20],
    ['Nombre del equipo', 22],
    ['Analista', 20],
    ['Estación', 10],
    ['Tipo de disco', 14],
    ['Capacidad', 12],
    ['RAM', 10],
    ['Estado', 18],
    ['Fecha de ingreso', 16],
    ['Fecha de salida', 16],
    ['Retirado por', 20],
    ['Observaciones', 30],
  ];
  hoja.columns = columnas.map(([header, width]) => ({ header, width }));
  hoja.addRow(['Juan Pérez', '28012545', 'Lenovo 8910', '00-34-7E-0F-E8-38', 'DEPAREF0FE838', '', '6', 'SSD', '256 GB', '8 GB', 'Recibido', '01/10/2026', '', '', '']);
  hoja.addRow(['María López', '28012546', 'HP ProBook 450', 'A4-5E-60-1B-2C-3D', 'HP450-2C3D', '', '3', 'HDD', '500 GB', '8 GB', 'Entregado', '02/10/2026', '05/10/2026', 'María López', 'Entrega conforme']);
  const cab = hoja.getRow(1);
  cab.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B0D1A' } };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];
  hoja.getColumn(2).numFmt = '@';
  hoja.getColumn(12).numFmt = '@';
  hoja.getColumn(13).numFmt = '@';

  const ayuda = wb.addWorksheet('Instrucciones');
  ayuda.columns = [
    { header: 'Columna', width: 22 },
    { header: 'Obligatoria', width: 13 },
    { header: 'Qué poner', width: 90 },
  ];
  ayuda.getRow(1).font = { bold: true };
  const filas: [string, string, string][] = [
    ['Usuario', 'Sí', 'Nombre del cliente o propietario del equipo.'],
    ['Etiqueta', 'Sí', 'Código del equipo. No puede repetirse ni existir ya en el sistema.'],
    ['Modelo', 'Sí', 'Modelo del equipo.'],
    ['MAC', 'Sí', 'Con o sin separadores, por ejemplo 00-34-7E-0F-E8-38.'],
    ['Nombre del equipo', 'Sí', 'Nombre de red del equipo.'],
    ['Analista', 'No', 'Indicador o nombre completo de un analista ya registrado. Vacío = el administrador que importa.'],
    ['Estación', 'No', 'Vacío = la estación del analista.'],
    ['Tipo de disco', 'No', 'HDD (duro), SSD (sólido), Otro. Vacío = no especificado.'],
    ['Capacidad / RAM', 'No', 'Texto como «256 GB» o «1 TB». Un número solo se entiende como GB.'],
    ['Estado', 'No', `Uno de: ${ESTADOS.join(', ')}. Vacío = Recibido.`],
    ['Fecha de ingreso', 'No', 'dd/mm/aaaa (opcionalmente con hora hh:mm). Vacío = ahora.'],
    ['Fecha de salida / Retirado por', 'Solo si «Entregado»', 'Se piden cuando el estado es Entregado.'],
    ['Observaciones', 'No', 'Texto libre.'],
    ['Otras columnas', '—', 'Se ignoran (por ejemplo «Número»: el número de registro lo asigna el sistema).'],
  ];
  filas.forEach((f) => ayuda.addRow(f));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_equipos_sti.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});
