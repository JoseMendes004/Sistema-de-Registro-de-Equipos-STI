import { Palette, Pencil, Save, Settings, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { mensajeError } from '../api';
import { Aviso, Cabecera } from '../components';
import { ImportarEquipos } from './Importar';
import { ACENTOS, acentoDe, FONDOS, cargarPaletas, guardarPaletas, guardarTema, hexDeTono, leerTema, MAX_PALETAS } from '../tema';
import type { Paleta, Tema } from '../tema';

export function Configuracion() {
  const [tema, setTema] = useState<Tema>(leerTema);
  const [paletas, setPaletas] = useState<Paleta[]>([]);
  const [error, setError] = useState('');
  const [nombrePaleta, setNombrePaleta] = useState('');
  // Paleta en edición: nombre nuevo y colores que había antes (para poder cancelar).
  const [editando, setEditando] = useState<{ id: string; texto: string; previo: Tema } | null>(null);
  const avisoEdicion = useRef<HTMLFormElement>(null);

  useEffect(() => {
    cargarPaletas()
      .then(setPaletas)
      .catch((e) => setError(mensajeError(e)));
  }, []);

  /** Guarda la lista en el servidor; si falla, avisa y mantiene la lista anterior. */
  async function persistirPaletas(lista: Paleta[]) {
    const anterior = paletas;
    setPaletas(lista);
    try {
      await guardarPaletas(lista);
      setError('');
    } catch (e) {
      setPaletas(anterior);
      setError(mensajeError(e));
    }
  }

  const cambiarTema = (cambios: Partial<Tema>) => {
    const nuevo = { ...tema, ...cambios };
    setTema(nuevo);
    guardarTema(nuevo);
  };

  function guardarPaletaActual(e: FormEvent) {
    e.preventDefault();
    const nombre = nombrePaleta.trim() || `Paleta ${paletas.length + 1}`;
    const lista = [...paletas, { id: `${Date.now()}`, nombre: nombre.slice(0, 24), h: tema.h, s: tema.s, fondo: tema.fondo }].slice(-MAX_PALETAS);
    persistirPaletas(lista);
    setNombrePaleta('');
  }

  function empezarEdicion(p: Paleta) {
    setEditando({ id: p.id, texto: p.nombre, previo: tema });
    cambiarTema({ h: p.h, s: p.s, fondo: p.fondo });
    // La paleta se carga en los selectores de arriba: se lleva la vista hasta ellos.
    setTimeout(() => avisoEdicion.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }

  function guardarEdicion(e: FormEvent) {
    e.preventDefault();
    if (!editando) return;
    const nombre = editando.texto.trim().slice(0, 24);
    const lista = paletas.map((p) =>
      p.id === editando.id ? { ...p, nombre: nombre || p.nombre, h: tema.h, s: tema.s, fondo: tema.fondo } : p,
    );
    persistirPaletas(lista);
    setEditando(null);
  }

  function cancelarEdicion() {
    if (editando) cambiarTema(editando.previo);
    setEditando(null);
  }

  function borrarPaleta(id: string) {
    if (editando?.id === id) cancelarEdicion();
    const lista = paletas.filter((p) => p.id !== id);
    persistirPaletas(lista);
  }


  return (
    <>
      <Cabecera icono={<Settings size={24} />} titulo="Ajustes" subtitulo="Opciones del administrador: colores de la página e importación de equipos desde Excel." />
      {error && <Aviso>{error}</Aviso>}
      <div className="ajustes">
        <section className="panel">
          <h2>
            <Palette size={18} style={{ verticalAlign: '-2px' }} /> Paleta de colores
          </h2>

          {editando && (
            <form ref={avisoEdicion} className="edicion-paleta" onSubmit={guardarEdicion}>
              <span className="campo-etiqueta">Editando la paleta: cambia el nombre y los colores de abajo</span>
              <div className="guardar-paleta">
                <input
                  value={editando.texto}
                  onChange={(e) => setEditando({ ...editando, texto: e.target.value })}
                  onKeyDown={(e) => e.key === 'Escape' && cancelarEdicion()}
                  maxLength={24}
                  aria-label="Nombre de la paleta"
                  autoFocus
                />
                <button className="btn primario">
                  <Save size={15} /> Guardar cambios
                </button>
                <button type="button" className="btn" onClick={cancelarEdicion}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="paleta-grupo">
            <span className="campo-etiqueta">Color principal</span>
            <div className="muestras">
              {ACENTOS.map((a) => (
                <button
                  key={a.h}
                  type="button"
                  className="muestra"
                  aria-pressed={tema.h === a.h && tema.s === 1}
                  onClick={() => cambiarTema({ h: a.h, s: 1 })}
                >
                  <span className="muestra-color" style={{ background: `hsl(${a.h} 70% 48%)` }} />
                  {a.nombre}
                </button>
              ))}
              <label className="muestra" title="Elegir cualquier color principal">
                <input
                  type="color"
                  className="muestra-selector"
                  value={hexDeTono(tema.h, 80 * tema.s, 48)}
                  onChange={(e) => cambiarTema(acentoDe(e.target.value))}
                  aria-label="Elegir un color principal"
                />
                Otro color
              </label>
            </div>
          </div>

          <div className="paleta-grupo">
            <span className="campo-etiqueta">Fondo de la página</span>
            <div className="muestras">
              {FONDOS.map((fd) => (
                <button
                  key={fd.color}
                  type="button"
                  className="muestra"
                  aria-pressed={tema.fondo === fd.color}
                  onClick={() => cambiarTema({ fondo: fd.color })}
                >
                  <span className="muestra-color" style={{ background: fd.color }} />
                  {fd.nombre}
                </button>
              ))}
              <label className="muestra" title="Elegir cualquier color de fondo">
                <input
                  type="color"
                  className="muestra-selector"
                  value={tema.fondo}
                  onChange={(e) => cambiarTema({ fondo: e.target.value })}
                  aria-label="Elegir un color de fondo"
                />
                Otro color
              </label>
            </div>
          </div>

          <div className="paleta-grupo">
            <span className="campo-etiqueta">Guardar la paleta actual</span>
            {editando ? (
              <p className="nota">Termina o cancela la edición para guardar una paleta nueva.</p>
            ) : paletas.length < MAX_PALETAS ? (
              <form className="guardar-paleta" onSubmit={guardarPaletaActual}>
                <input
                  value={nombrePaleta}
                  onChange={(e) => setNombrePaleta(e.target.value)}
                  placeholder="Nombre de la paleta (opcional)"
                  maxLength={24}
                  aria-label="Nombre de la paleta"
                />
                <button className="btn">
                  <Save size={15} /> Guardar colores actuales
                </button>
              </form>
            ) : (
              <p className="nota">Llegaste al máximo de {MAX_PALETAS} paletas; elimina alguna para guardar otra.</p>
            )}
          </div>

          <div className="paleta-grupo">
            <span className="campo-etiqueta">Mis paletas guardadas</span>
            {paletas.length === 0 ? (
              <p className="nota">Aún no has guardado ninguna paleta.</p>
            ) : (
              <div className="paletas">
                {paletas.map((p) => (
                  <div key={p.id} className="paleta-chip" data-activa={p.h === tema.h && p.s === tema.s && p.fondo === tema.fondo} data-editando={editando?.id === p.id}>
                        <button type="button" className="paleta-aplicar" onClick={() => cambiarTema({ h: p.h, s: p.s, fondo: p.fondo })} title="Aplicar esta paleta">
                          <span className="paleta-dos" style={{ background: p.fondo }}>
                            <span style={{ background: `hsl(${p.h} ${70 * p.s}% 48%)` }} />
                          </span>
                          {p.nombre}
                        </button>
                        <button type="button" className="paleta-borrar" onClick={() => empezarEdicion(p)} aria-label={`Editar ${p.nombre}`} title="Editar nombre y colores">
                          <Pencil size={13} />
                        </button>
                        <button type="button" className="paleta-borrar" onClick={() => borrarPaleta(p.id)} aria-label={`Eliminar ${p.nombre}`} title="Eliminar">
                          <X size={13} />
                        </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <ImportarEquipos />
      </div>
    </>
  );
}
