import { FileBarChart, FileSpreadsheet, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, mensajeError, qs } from '../api';
import { useUsuario } from '../auth';
import { Aviso, Cabecera, Confirmar, Insignia, Vacio } from '../components';
import { ESTADOS } from '../types';
import type { Catalogos, Equipo, ListaEquipos } from '../types';
import { fechaHora, nombreDisco, numeroRegistro } from '../util';

const VACIO = {
  desde: '',
  hasta: '',
  salida_desde: '',
  salida_hasta: '',
  analista_id: '',
  estacion: '',
  estado: '',
  modelo: '',
};

export function Reportes() {
  const usuario = useUsuario();
  const esAdmin = usuario.rol === 'admin';
  const [aEliminar, setAEliminar] = useState<Equipo | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [aviso, setAviso] = useState('');
  const [f, setF] = useState(VACIO);
  const [lista, setLista] = useState<ListaEquipos | null>(null);
  const [catalogos, setCatalogos] = useState<Catalogos>({ analistas: [], estaciones: [] });
  const [error, setError] = useState('');

  const cambiar = (k: keyof typeof VACIO, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
  };

  useEffect(() => {
    api<Catalogos>('/usuarios/analistas').then(setCatalogos).catch(() => {});
  }, []);

  useEffect(() => {
    let vigente = true;
    const t = setTimeout(() => {
      api<ListaEquipos>(`/equipos${qs({ ...f, por_pagina: 1000 })}`)
        .then((r) => {
          if (!vigente) return;
          setLista(r);
          setError('');
        })
        .catch((e) => vigente && setError(mensajeError(e)));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [f, recarga]);

  async function eliminar() {
    if (!aEliminar) return;
    setEliminando(true);
    try {
      await api(`/equipos/${aEliminar.id}`, { method: 'DELETE' });
      setAviso(`Registro ${numeroRegistro(aEliminar.numero_registro)} eliminado.`);
      setError('');
      setRecarga((n) => n + 1);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setAEliminar(null);
      setEliminando(false);
    }
  }

  // El Excel incluye todos los registros que cumplen los filtros (hasta 10 000).
  const exportar = `/api/reportes/export${qs({ ...f, formato: 'xlsx' })}`;
  const fecha = (k: keyof typeof VACIO, etiqueta: string) => (
    <label className="campo">
      <span className="campo-etiqueta">{etiqueta}</span>
      <input type="date" value={f[k]} onChange={(e) => cambiar(k, e.target.value)} />
    </label>
  );

  return (
    <>
      <Cabecera
        icono={<FileBarChart size={24} />}
        titulo="Reportes"
        subtitulo="Filtra los registros y expórtalos a Excel."
        acciones={
          <a className="btn primario" href={exportar} download>
            <FileSpreadsheet size={16} /> Excel
          </a>
        }
      />

      <section className="panel filtros no-imprimir">
        {fecha('desde', 'Ingreso desde')}
        {fecha('hasta', 'Ingreso hasta')}
        {fecha('salida_desde', 'Salida desde')}
        {fecha('salida_hasta', 'Salida hasta')}
        <label className="campo">
          <span className="campo-etiqueta">Analista</span>
          <select value={f.analista_id} onChange={(e) => cambiar('analista_id', e.target.value)}>
            <option value="">Todos</option>
            {catalogos.analistas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span className="campo-etiqueta">Estación</span>
          <select value={f.estacion} onChange={(e) => cambiar('estacion', e.target.value)}>
            <option value="">Todas</option>
            {catalogos.estaciones.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span className="campo-etiqueta">Estado</span>
          <select value={f.estado} onChange={(e) => cambiar('estado', e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span className="campo-etiqueta">Tipo de equipo (modelo)</span>
          <input value={f.modelo} onChange={(e) => cambiar('modelo', e.target.value)} placeholder="Ej.: Lenovo" />
        </label>
        <button className="btn" onClick={() => setF(VACIO)}>
          <RotateCcw size={15} /> Limpiar
        </button>
      </section>

      {aviso && <Aviso tipo="ok">{aviso}</Aviso>}
      {error && <Aviso>{error}</Aviso>}

      <section className="panel sin-relleno">
        <div className="panel-cabecera con-relleno">
          <h2>Resultado</h2>
          <span className="nota">{lista ? `${lista.total} registro(s)` : ''}</span>
        </div>
        {lista && lista.items.length === 0 ? (
          <Vacio>Ningún registro coincide con los filtros.</Vacio>
        ) : (
          <div className="tabla-contenedor tabla-alta tabla-reportes">
            <table className="tabla tabla-resp">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ingreso</th>
                  <th>Usuario</th>
                  <th>Etiqueta</th>
                  <th>Modelo</th>
                  <th>Analista</th>
                  <th>Est.</th>
                  <th>Activ.</th>
                  <th>Disco</th>
                  <th>RAM</th>
                  <th>Estado</th>
                  <th>Salida</th>
                  {esAdmin && <th className="derecha">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {lista?.items.map((e) => (
                  <tr key={e.id}>
                    <td data-label="#">
                      <Link className="enlace fuerte" to={`/equipos/${e.id}`}>
                        {numeroRegistro(e.numero_registro)}
                      </Link>
                    </td>
                    <td data-label="Ingreso">{fechaHora(e.fecha_ingreso)}</td>
                    <td data-label="Usuario">{e.usuario_propietario}</td>
                    <td data-label="Etiqueta">{e.etiqueta}</td>
                    <td data-label="Modelo">{e.modelo}</td>
                    <td data-label="Analista">{e.analista}</td>
                    <td data-label="Estación">{e.estacion}</td>
                    <td data-label="Actividades">
                      {e.actividades_hechas}/{lista.total_actividades}
                    </td>
                    <td data-label="Disco">
                      {nombreDisco(e.tipo_disco)} {e.capacidad_disco}
                    </td>
                    <td data-label="RAM">{e.ram || '—'}</td>
                    <td data-label="Estado">
                      <Insignia estado={e.estado} />
                    </td>
                    <td data-label="Salida">{fechaHora(e.fecha_salida)}</td>
                    {esAdmin && (
                      <td data-label="Acciones" className="derecha">
                        <div className="acciones-fila acciones-derecha">
                          <button className="btn-accion rojo" title="Eliminar registro" aria-label={`Eliminar el registro ${numeroRegistro(e.numero_registro)}`} onClick={() => setAEliminar(e)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {aEliminar && (
        <Confirmar
          titulo="Eliminar registro"
          mensaje={
            <>
              Se eliminará definitivamente el registro <strong>{numeroRegistro(aEliminar.numero_registro)}</strong> ({aEliminar.modelo},{' '}
              {aEliminar.usuario_propietario}) junto con sus actividades, estados y datos de salida. Esta acción no se puede deshacer.
            </>
          }
          textoAccion="Eliminar"
          peligro
          ocupado={eliminando}
          onConfirmar={eliminar}
          onCancelar={() => setAEliminar(null)}
        />
      )}
    </>
  );
}
