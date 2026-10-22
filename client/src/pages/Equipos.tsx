import { ArrowDownUp, ClipboardList, Eye, LogOut, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, mensajeError, qs } from '../api';
import { useUsuario } from '../auth';
import { Aviso, Cabecera, Confirmar, Insignia, Paginacion, Progreso, Vacio } from '../components';
import { ESTADOS } from '../types';
import type { Catalogos, Equipo, ListaEquipos } from '../types';
import { fechaHora, nombreDisco, numeroRegistro } from '../util';

export function Equipos() {
  const usuario = useUsuario();
  const [params, setParams] = useSearchParams();
  const [lista, setLista] = useState<ListaEquipos | null>(null);
  const [catalogos, setCatalogos] = useState<Catalogos>({ analistas: [], estaciones: [] });
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState(params.get('q') ?? '');
  const [aEliminar, setAEliminar] = useState<Equipo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [recarga, setRecarga] = useState(0);

  const filtros = {
    q: params.get('q') ?? '',
    estado: params.get('estado') ?? '',
    desde: params.get('desde') ?? '',
    hasta: params.get('hasta') ?? '',
    estacion: params.get('estacion') ?? '',
    orden: params.get('orden') ?? 'fecha_desc',
    pagina: Number(params.get('pagina') ?? 1),
  };
  const clave = JSON.stringify(filtros);

  function cambiar(cambios: Record<string, string | number>) {
    const p = new URLSearchParams(params);
    if (!('pagina' in cambios)) p.delete('pagina');
    for (const [k, v] of Object.entries(cambios)) {
      if (v === '' || (k === 'pagina' && v === 1) || (k === 'orden' && v === 'fecha_desc')) p.delete(k);
      else p.set(k, String(v));
    }
    setParams(p, { replace: true });
  }

  // La búsqueda se aplica con un pequeño retardo mientras se escribe.
  useEffect(() => {
    if (busqueda === filtros.q) return;
    const t = setTimeout(() => cambiar({ q: busqueda.trim() }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  useEffect(() => {
    api<Catalogos>('/usuarios/analistas').then(setCatalogos).catch(() => {});
  }, []);

  useEffect(() => {
    let vigente = true;
    api<ListaEquipos>(`/equipos${qs({ ...filtros, por_pagina: 10 })}`)
      .then((r) => {
        if (!vigente) return;
        setLista(r);
        setError('');
      })
      .catch((e) => vigente && setError(mensajeError(e)));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, recarga]);

  async function eliminar() {
    if (!aEliminar) return;
    setOcupado(true);
    try {
      await api(`/equipos/${aEliminar.id}`, { method: 'DELETE' });
      setAEliminar(null);
      setRecarga((n) => n + 1);
    } catch (e) {
      setError(mensajeError(e));
      setAEliminar(null);
    } finally {
      setOcupado(false);
    }
  }

  const puedeOperar = (e: Equipo) => e.estado !== 'Entregado';
  const hayFiltros = filtros.q || filtros.estado || filtros.desde || filtros.hasta || filtros.estacion;

  return (
    <>
      <Cabecera
        icono={<ClipboardList size={24} />}
        titulo="Registro de Equipos"
        subtitulo="Consulta y gestiona todos los equipos registrados en el laboratorio STI."
        acciones={
          <Link to="/equipos/nuevo" className="btn primario">
            <Plus size={16} /> Registrar nuevo equipo
          </Link>
        }
      />

      <section className="panel filtros">
        <label className="campo filtro-busqueda">
          <span className="campo-etiqueta">Buscar</span>
          <div className="entrada-icono">
            <Search size={16} />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Usuario, etiqueta, modelo, MAC, equipo o analista…"
            />
          </div>
        </label>
        <label className="campo">
          <span className="campo-etiqueta">Estado</span>
          <select value={filtros.estado} onChange={(e) => cambiar({ estado: e.target.value })}>
            <option value="">Todos</option>
            {ESTADOS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span className="campo-etiqueta">Ingreso desde</span>
          <input type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={(e) => cambiar({ desde: e.target.value })} />
        </label>
        <label className="campo">
          <span className="campo-etiqueta">Ingreso hasta</span>
          <input type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={(e) => cambiar({ hasta: e.target.value })} />
        </label>
        <label className="campo">
          <span className="campo-etiqueta">Estación</span>
          <select value={filtros.estacion} onChange={(e) => cambiar({ estacion: e.target.value })}>
            <option value="">Todas</option>
            {catalogos.estaciones.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button
          className="btn"
          disabled={!hayFiltros}
          onClick={() => {
            setBusqueda('');
            setParams({}, { replace: true });
          }}
        >
          <RotateCcw size={15} /> Limpiar filtros
        </button>
      </section>

      {error && <Aviso>{error}</Aviso>}

      <section className="panel sin-relleno">
        {lista && lista.items.length === 0 ? (
          <Vacio>
            {hayFiltros ? 'Ningún equipo coincide con los filtros aplicados.' : 'Aún no hay equipos registrados.'}
          </Vacio>
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla tabla-resp tabla-registros">
              <thead>
                <tr>
                  <th>#</th>
                  <th>
                    <button
                      className="orden"
                      onClick={() => cambiar({ orden: filtros.orden === 'fecha_desc' ? 'fecha_asc' : 'fecha_desc' })}
                      title="Cambiar el orden por fecha de ingreso"
                    >
                      Fecha ingreso <ArrowDownUp size={13} />
                      <span className="orden-sentido">{filtros.orden === 'fecha_desc' ? '↓' : '↑'}</span>
                    </button>
                  </th>
                  <th>Usuario / Propietario</th>
                  <th>Etiqueta</th>
                  <th>Equipo (modelo)</th>
                  <th>MAC</th>
                  <th>Nombre del equipo</th>
                  <th>Analista</th>
                  <th>Estación</th>
                  <th>Actividades</th>
                  <th>Disco</th>
                  <th>Capacidad</th>
                  <th>RAM</th>
                  <th>Estado</th>
                  <th>Fecha salida</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista?.items.map((e) => (
                  <tr key={e.id}>
                    <td data-label="# Registro">
                      <Link className="enlace fuerte" to={`/equipos/${e.id}`}>
                        {numeroRegistro(e.numero_registro)}
                      </Link>
                    </td>
                    <td data-label="Fecha ingreso">{fechaHora(e.fecha_ingreso)}</td>
                    <td data-label="Usuario">{e.usuario_propietario}</td>
                    <td data-label="Etiqueta">{e.etiqueta}</td>
                    <td data-label="Equipo">{e.modelo}</td>
                    <td data-label="MAC" className="mono">
                      {e.mac}
                    </td>
                    <td data-label="Nombre" className="mono">
                      {e.nombre_equipo}
                    </td>
                    <td data-label="Analista">{e.analista}</td>
                    <td data-label="Estación">{e.estacion}</td>
                    <td data-label="Actividades">
                      <Link to={`/equipos/${e.id}#actividades`} className="enlace-progreso" title="Ver el detalle de las actividades">
                        <Progreso hechas={e.actividades_hechas} total={lista.total_actividades} />
                      </Link>
                    </td>
                    <td data-label="Disco">{nombreDisco(e.tipo_disco)}</td>
                    <td data-label="Capacidad">{e.capacidad_disco || '—'}</td>
                    <td data-label="RAM">{e.ram || '—'}</td>
                    <td data-label="Estado">
                      <Insignia estado={e.estado} />
                    </td>
                    <td data-label="Fecha salida">{fechaHora(e.fecha_salida)}</td>
                    <td data-label="Acciones">
                      <div className="acciones-fila">
                        <Link to={`/equipos/${e.id}`} className="btn-accion" title="Ver detalles e historial" aria-label="Ver detalles">
                          <Eye size={15} />
                        </Link>
                        {(usuario.rol === 'admin' || puedeOperar(e)) && (
                          <Link to={`/equipos/${e.id}/editar`} className="btn-accion" title="Editar registro" aria-label="Editar">
                            <Pencil size={15} />
                          </Link>
                        )}
                        {puedeOperar(e) && (
                          <Link to={`/equipos/${e.id}?salida=1`} className="btn-accion verde" title="Registrar salida" aria-label="Registrar salida">
                            <LogOut size={15} />
                          </Link>
                        )}
                        {usuario.rol === 'admin' && (
                          <button className="btn-accion rojo" title="Eliminar registro" aria-label="Eliminar" onClick={() => setAEliminar(e)}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lista && lista.total > 0 && (
          <Paginacion pagina={lista.pagina} porPagina={lista.por_pagina} total={lista.total} onCambiar={(p) => cambiar({ pagina: p })} />
        )}
      </section>

      {aEliminar && (
        <Confirmar
          titulo="Eliminar registro"
          mensaje={
            <>
              Se eliminará definitivamente el registro <strong>{numeroRegistro(aEliminar.numero_registro)}</strong> (
              {aEliminar.modelo}, {aEliminar.usuario_propietario}) junto con su historial. Esta acción no se puede deshacer.
            </>
          }
          textoAccion="Eliminar"
          peligro
          ocupado={ocupado}
          onConfirmar={eliminar}
          onCancelar={() => setAEliminar(null)}
        />
      )}
    </>
  );
}
