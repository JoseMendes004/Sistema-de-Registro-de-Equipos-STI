import { FileSpreadsheet, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiArchivo, mensajeError } from '../api';
import { Aviso, Confirmar } from '../components';

interface FilaVista {
  fila: number;
  errores: string[];
  vista: { usuario: string; etiqueta: string; modelo: string; mac: string; nombre: string; analista: string; estado: string };
}

interface VistaPrevia {
  total: number;
  validas: number;
  con_errores: number;
  ignoradas: string[];
  filas: FilaVista[];
}

/** Sección de Ajustes (solo administrador): carga equipos desde un Excel. */
export function ImportarEquipos() {
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<VistaPrevia | null>(null);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<{ creados: number; omitidos: number } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);

  async function elegir(f: File | undefined) {
    if (!f) return;
    setError('');
    setResultado(null);
    setPrevia(null);
    setArchivo(null);
    if (!/\.xlsx$/i.test(f.name)) {
      setError('Elige un archivo de Excel con extensión .xlsx (si tienes .xls o .csv, guárdalo como .xlsx).');
      return;
    }
    setOcupado(true);
    try {
      setPrevia(await apiArchivo<VistaPrevia>('/importar/vista-previa', f));
      setArchivo(f);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
      if (entrada.current) entrada.current.value = '';
    }
  }

  async function importar() {
    if (!archivo) return;
    setOcupado(true);
    try {
      setResultado(await apiArchivo<{ creados: number; omitidos: number }>('/importar/confirmar', archivo));
      setPrevia(null);
      setArchivo(null);
      setError('');
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
      setConfirmando(false);
    }
  }

  function soltar(e: DragEvent) {
    e.preventDefault();
    setArrastrando(false);
    elegir(e.dataTransfer.files[0]);
  }

  return (
    <>
      {error && <Aviso>{error}</Aviso>}
      {resultado && (
        <Aviso tipo="ok">
          Se importaron {resultado.creados} equipo(s).
          {resultado.omitidos > 0 && ` Se omitieron ${resultado.omitidos} fila(s) con errores.`}{' '}
          <Link to="/equipos" className="enlace">
            Ver el registro de equipos
          </Link>
        </Aviso>
      )}

      <section className="panel">
        <div className="panel-cabecera">
          <h2>
            <FileSpreadsheet size={18} style={{ verticalAlign: '-2px' }} /> Importar equipos desde Excel
          </h2>
        </div>
        <div
          className={`zona-archivo${arrastrando ? ' sobre' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={soltar}
        >
          <Upload size={30} />
          <p>
            <strong>Arrastra aquí tu archivo Excel</strong> o
          </p>
          <label className="btn primario">
            {ocupado && !previa ? 'Leyendo…' : 'Elegir archivo'}
            <input ref={entrada} type="file" accept=".xlsx" hidden disabled={ocupado} onChange={(e) => elegir(e.target.files?.[0])} />
          </label>
          <p className="nota">
            Formato .xlsx, hasta 1000 filas. La primera fila lleva los encabezados. Obligatorios: Usuario, Etiqueta, Modelo, MAC y Nombre del equipo;
            opcionales: Analista, Estación, Tipo de disco, Capacidad, RAM, Estado, Fecha de ingreso, Fecha de salida, Retirado por y Observaciones.
            El número de registro lo asigna el sistema.
          </p>
        </div>
      </section>

      {previa && (
        <section className="panel sin-relleno">
          <div className="panel-cabecera con-relleno">
            <h2>Vista previa · {archivo?.name}</h2>
            <div className="resumen-import">
              <span className="insignia neutro">{previa.total} filas</span>
              <span className="insignia verde-suave">{previa.validas} válidas</span>
              {previa.con_errores > 0 && <span className="insignia rojo">{previa.con_errores} con errores</span>}
            </div>
          </div>
          {previa.ignoradas.length > 0 && <p className="nota nota-relleno">Columnas ignoradas: {previa.ignoradas.join(', ')}.</p>}
          <div className="tabla-contenedor tabla-alta">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Usuario</th>
                  <th>Etiqueta</th>
                  <th>Modelo</th>
                  <th>MAC</th>
                  <th>Nombre del equipo</th>
                  <th>Analista</th>
                  <th>Estado</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {previa.filas.map((f) => (
                  <tr key={f.fila} className={f.errores.length ? 'fila-error' : ''}>
                    <td>{f.fila}</td>
                    <td>{f.vista.usuario}</td>
                    <td>{f.vista.etiqueta}</td>
                    <td>{f.vista.modelo}</td>
                    <td className="mono">{f.vista.mac}</td>
                    <td className="mono">{f.vista.nombre}</td>
                    <td>{f.vista.analista}</td>
                    <td>{f.vista.estado}</td>
                    <td>
                      {f.errores.length ? <span className="error-fila">{f.errores.join(' ')}</span> : <span className="ok-fila">Lista para importar</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="acciones-formulario pie-import">
            <button
              className="btn"
              onClick={() => {
                setPrevia(null);
                setArchivo(null);
              }}
              disabled={ocupado}
            >
              Cancelar
            </button>
            <button className="btn primario" onClick={() => setConfirmando(true)} disabled={ocupado || previa.validas === 0}>
              Importar {previa.validas} equipo(s)
            </button>
          </div>
        </section>
      )}

      {confirmando && previa && (
        <Confirmar
          titulo="Confirmar importación"
          mensaje={
            <>
              Se crearán <strong>{previa.validas}</strong> equipo(s) en la base de datos.
              {previa.con_errores > 0 && <> Las {previa.con_errores} fila(s) con errores se omitirán.</>} Los equipos nuevos quedan a nombre del analista
              indicado (o tuyo si no se indicó) y su ingreso queda anotado como «importado desde Excel».
            </>
          }
          textoAccion="Importar"
          ocupado={ocupado}
          onConfirmar={importar}
          onCancelar={() => setConfirmando(false)}
        />
      )}
    </>
  );
}
