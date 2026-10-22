import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, Wrench, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, mensajeError } from '../api';
import { Aviso, Cabecera, Confirmar } from '../components';
import type { Actividad } from '../types';

export function Actividades() {
  const [items, setItems] = useState<Actividad[]>([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [nueva, setNueva] = useState({ nombre: '', categoria: '' });
  const [edicion, setEdicion] = useState<Actividad | null>(null);
  const [aEliminar, setAEliminar] = useState<Actividad | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = () =>
    api<{ items: Actividad[] }>('/actividades')
      .then((r) => setItems(r.items))
      .catch((e) => setError(mensajeError(e)));
  useEffect(() => {
    cargar();
  }, []);

  async function ejecutar(fn: () => Promise<unknown>, mensaje = '') {
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      await fn();
      await cargar();
      setAviso(mensaje);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }

  function agregar(e: FormEvent) {
    e.preventDefault();
    if (!nueva.nombre.trim()) {
      setError('Escribe el nombre de la actividad.');
      return;
    }
    ejecutar(async () => {
      await api('/actividades', { method: 'POST', body: nueva });
      setNueva({ nombre: '', categoria: '' });
    }, 'Actividad agregada.');
  }

  function mover(i: number, delta: number) {
    const ids = items.map((a) => a.id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    ejecutar(() => api('/actividades/orden', { method: 'PUT', body: { ids } }));
  }

  const guardar = (a: Actividad, mensaje: string) =>
    ejecutar(async () => {
      await api(`/actividades/${a.id}`, { method: 'PUT', body: { nombre: a.nombre, categoria: a.categoria, activa: a.activa } });
      setEdicion(null);
    }, mensaje);

  return (
    <>
      <Cabecera
        icono={<Wrench size={24} />}
        titulo="Actividades Técnicas"
        subtitulo="Lista de tareas de la pizarra. Los cambios se aplican al checklist de todos los equipos."
      />
      {aviso && <Aviso tipo="ok">{aviso}</Aviso>}
      {error && <Aviso>{error}</Aviso>}

      <section className="panel">
        <h2>Agregar actividad</h2>
        <form className="fila-formulario" onSubmit={agregar} noValidate>
          <label className="campo crece">
            <span className="campo-etiqueta">Nombre</span>
            <input value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} maxLength={150} />
          </label>
          <label className="campo crece">
            <span className="campo-etiqueta">Categoría (opcional)</span>
            <input value={nueva.categoria} onChange={(e) => setNueva({ ...nueva, categoria: e.target.value })} maxLength={100} />
          </label>
          <button className="btn primario" disabled={ocupado}>
            <Plus size={16} /> Agregar
          </button>
        </form>
      </section>

      <section className="panel sin-relleno">
        <ul className="lista-actividades">
          {items.map((a, i) => (
            <li key={a.id} className={a.activa ? '' : 'inactiva'}>
              <span className="checklist-numero">{String(i + 1).padStart(2, '0')}</span>
              {edicion?.id === a.id ? (
                <form
                  className="actividad-edicion"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (edicion.nombre.trim()) guardar(edicion, 'Actividad actualizada.');
                  }}
                >
                  <input value={edicion.nombre} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} aria-label="Nombre" maxLength={150} autoFocus />
                  <input value={edicion.categoria} onChange={(e) => setEdicion({ ...edicion, categoria: e.target.value })} aria-label="Categoría" placeholder="Categoría" maxLength={100} />
                  <button className="btn-accion verde" title="Guardar" aria-label="Guardar" disabled={ocupado}>
                    <Check size={15} />
                  </button>
                  <button type="button" className="btn-accion" title="Cancelar" aria-label="Cancelar" onClick={() => setEdicion(null)}>
                    <X size={15} />
                  </button>
                </form>
              ) : (
                <>
                  <div className="actividad-texto">
                    <strong>{a.nombre}</strong>
                    <small>
                      {a.categoria || 'Sin categoría'}
                      {!a.activa && ' · Desactivada'}
                    </small>
                  </div>
                  <div className="acciones-fila">
                    <button className="btn-accion" title="Subir" aria-label="Subir" disabled={ocupado || i === 0} onClick={() => mover(i, -1)}>
                      <ArrowUp size={15} />
                    </button>
                    <button className="btn-accion" title="Bajar" aria-label="Bajar" disabled={ocupado || i === items.length - 1} onClick={() => mover(i, 1)}>
                      <ArrowDown size={15} />
                    </button>
                    <button className="btn-accion" title="Editar" aria-label="Editar" onClick={() => setEdicion(a)}>
                      <Pencil size={15} />
                    </button>
                    {a.activa ? (
                      <button className="btn-accion rojo" title="Eliminar" aria-label="Eliminar" onClick={() => setAEliminar(a)}>
                        <Trash2 size={15} />
                      </button>
                    ) : (
                      <button className="btn-accion verde" title="Reactivar" aria-label="Reactivar" disabled={ocupado} onClick={() => guardar({ ...a, activa: true }, 'Actividad reactivada.')}>
                        <Check size={15} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      {aEliminar && (
        <Confirmar
          titulo="Eliminar actividad"
          mensaje={
            aEliminar.usos > 0 ? (
              <>
                «{aEliminar.nombre}» ya se registró en {aEliminar.usos} equipo(s). Se <strong>desactivará</strong> para conservar
                ese historial y dejará de aparecer en los nuevos checklists.
              </>
            ) : (
              <>Se eliminará «{aEliminar.nombre}» de la lista de actividades.</>
            )
          }
          textoAccion={aEliminar.usos > 0 ? 'Desactivar' : 'Eliminar'}
          peligro
          ocupado={ocupado}
          onConfirmar={() => {
            const a = aEliminar;
            setAEliminar(null);
            ejecutar(() => api(`/actividades/${a.id}`, { method: 'DELETE' }), a.usos > 0 ? 'Actividad desactivada.' : 'Actividad eliminada.');
          }}
          onCancelar={() => setAEliminar(null)}
        />
      )}
    </>
  );
}
