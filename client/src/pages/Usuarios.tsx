import { KeyRound, Pencil, ShieldCheck, ShieldOff, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, camposError, mensajeError } from '../api';
import { useUsuario } from '../auth';
import { Aviso, Cabecera, Campo, Confirmar, Modal } from '../components';
import type { Usuario } from '../types';

export function Usuarios() {
  const yo = useUsuario();
  const [items, setItems] = useState<Usuario[]>([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [clavePara, setClavePara] = useState<Usuario | null>(null);
  const [aEliminar, setAEliminar] = useState<Usuario | null>(null);
  const [aCambiarRol, setACambiarRol] = useState<Usuario | null>(null);
  const [clave, setClave] = useState('');
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [errorModal, setErrorModal] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = () =>
    api<{ items: Usuario[] }>('/usuarios')
      .then((r) => setItems(r.items))
      .catch((e) => setError(mensajeError(e)));
  useEffect(() => {
    cargar();
  }, []);

  function cerrar() {
    setEditando(null);
    setClavePara(null);
    setAEliminar(null);
    setClave('');
    setCampos({});
    setErrorModal('');
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setOcupado(true);
    try {
      const { nombre, apellido, estacion, rol } = editando;
      await api(`/usuarios/${editando.id}`, { method: 'PUT', body: { nombre, apellido, estacion, rol } });
      cerrar();
      setAviso('Usuario actualizado.');
      await cargar();
    } catch (err) {
      setErrorModal(mensajeError(err));
      setCampos(camposError(err));
    } finally {
      setOcupado(false);
    }
  }

  async function guardarClave(e: FormEvent) {
    e.preventDefault();
    if (!clavePara) return;
    setOcupado(true);
    try {
      await api(`/usuarios/${clavePara.id}/clave`, { method: 'PUT', body: { clave } });
      setAviso(`Clave de ${clavePara.indicador} restablecida.`);
      cerrar();
    } catch (err) {
      setErrorModal(mensajeError(err));
      setCampos(camposError(err));
    } finally {
      setOcupado(false);
    }
  }

  async function eliminar(e: FormEvent) {
    e.preventDefault();
    if (!aEliminar) return;
    setOcupado(true);
    setError('');
    setAviso('');
    setErrorModal('');
    setCampos({});
    try {
      await api(`/usuarios/${aEliminar.id}`, { method: 'DELETE', body: { clave } });
      setAviso(`Usuario ${aEliminar.indicador} eliminado.`);
      cerrar();
      await cargar();
    } catch (err) {
      setErrorModal(mensajeError(err));
      setCampos(camposError(err));
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarRol() {
    if (!aCambiarRol) return;
    const u = aCambiarRol;
    const nuevo = u.rol === 'admin' ? 'analista' : 'admin';
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      await api(`/usuarios/${u.id}`, {
        method: 'PUT',
        body: { nombre: u.nombre, apellido: u.apellido, estacion: u.estacion, rol: nuevo },
      });
      setAviso(`${u.indicador} ahora es ${nuevo === 'admin' ? 'administrador' : 'analista'}.`);
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setACambiarRol(null);
      setOcupado(false);
    }
  }

  const editar = <K extends keyof Usuario>(k: K, v: Usuario[K]) => setEditando((u) => u && { ...u, [k]: v });

  return (
    <>
      <Cabecera icono={<Users size={24} />} titulo="Usuarios" subtitulo="Analistas y trabajadores autorizados del laboratorio." />
      {aviso && <Aviso tipo="ok">{aviso}</Aviso>}
      {error && <Aviso>{error}</Aviso>}

      <section className="panel sin-relleno">
        <div className="tabla-contenedor">
          <table className="tabla tabla-resp tabla-usuarios">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Apellido</th>
                <th>Indicador</th>
                <th className="centrado">Estación</th>
                <th>Rol</th>
                <th className="centrado">Equipos</th>
                <th className="derecha">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td data-label="Nombre">{u.nombre}</td>
                  <td data-label="Apellido">{u.apellido}</td>
                  <td data-label="Indicador" className="mono">
                    {u.indicador}
                  </td>
                  <td data-label="Estación" className="centrado">
                    {u.estacion}
                  </td>
                  <td data-label="Rol">
                    <span className={`insignia ${u.rol === 'admin' ? 'acento' : 'neutro'}`}>{u.rol === 'admin' ? 'Administrador' : 'Analista'}</span>
                  </td>
                  <td data-label="Equipos" className="centrado">
                    {u.equipos}
                  </td>
                  <td data-label="Acciones" className="derecha">
                    <div className="acciones-fila acciones-derecha">
                      <button className="btn-accion" title="Editar usuario y permisos" aria-label="Editar" onClick={() => setEditando(u)}>
                        <Pencil size={15} />
                      </button>
                      <button className="btn-accion" title="Restablecer clave" aria-label="Restablecer clave" onClick={() => setClavePara(u)}>
                        <KeyRound size={15} />
                      </button>
                      <button
                        className="btn-accion"
                        title={u.id === yo.id ? 'No puedes cambiar tu propio rol' : u.rol === 'admin' ? 'Quitar rol de administrador' : 'Convertir en administrador'}
                        aria-label={u.rol === 'admin' ? 'Quitar rol de administrador' : 'Convertir en administrador'}
                        disabled={u.id === yo.id}
                        onClick={() => setACambiarRol(u)}
                      >
                        {u.rol === 'admin' ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                      </button>
                      <button
                        className="btn-accion rojo"
                        title={u.id === yo.id ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario'}
                        aria-label="Eliminar usuario"
                        disabled={u.id === yo.id}
                        onClick={() => setAEliminar(u)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editando && (
        <Modal
          titulo={`Editar usuario — ${editando.indicador}`}
          onCerrar={cerrar}
          pie={
            <>
              <button className="btn" onClick={cerrar}>
                Cancelar
              </button>
              <button className="btn primario" form="form-usuario" disabled={ocupado}>
                Guardar
              </button>
            </>
          }
        >
          <form id="form-usuario" onSubmit={guardar} noValidate>
            {errorModal && <Aviso>{errorModal}</Aviso>}
            <div className="rejilla dos">
              <Campo etiqueta="Nombre" error={campos.nombre}>
                <input value={editando.nombre} onChange={(e) => editar('nombre', e.target.value)} />
              </Campo>
              <Campo etiqueta="Apellido" error={campos.apellido}>
                <input value={editando.apellido} onChange={(e) => editar('apellido', e.target.value)} />
              </Campo>
              <Campo etiqueta="Estación de trabajo" error={campos.estacion}>
                <input value={editando.estacion} onChange={(e) => editar('estacion', e.target.value)} />
              </Campo>
              <Campo etiqueta="Rol" ayuda={editando.id === yo.id ? 'No puedes cambiar tu propio rol.' : undefined}>
                <select value={editando.rol} disabled={editando.id === yo.id} onChange={(e) => editar('rol', e.target.value as Usuario['rol'])}>
                  <option value="analista">Analista</option>
                  <option value="admin">Administrador</option>
                </select>
              </Campo>
            </div>
          </form>
        </Modal>
      )}

      {aEliminar && (
        <Modal
          titulo="Eliminar usuario"
          onCerrar={cerrar}
          pie={
            <>
              <button className="btn" onClick={cerrar} disabled={ocupado}>
                Cancelar
              </button>
              <button className="btn peligro" form="form-eliminar" disabled={ocupado}>
                {ocupado ? 'Eliminando…' : 'Eliminar usuario'}
              </button>
            </>
          }
        >
          <form id="form-eliminar" onSubmit={eliminar} noValidate>
            {errorModal && !campos.clave && <Aviso>{errorModal}</Aviso>}
            <p className="confirmar-mensaje">
              Se eliminará definitivamente a{' '}
              <strong>
                {aEliminar.nombre} {aEliminar.apellido}
              </strong>{' '}
              ({aEliminar.indicador}).
              {(aEliminar.equipos ?? 0) > 0 && (
                <>
                  {' '}
                  Sus <strong>{aEliminar.equipos}</strong> equipo(s) registrado(s) y sus movimientos se conservan y seguirán mostrando su nombre.
                </>
              )}
            </p>
            <Campo etiqueta="Tu clave de administrador" error={campos.clave} ayuda="Escríbela para confirmar la eliminación.">
              <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" autoFocus />
            </Campo>
          </form>
        </Modal>
      )}

      {aCambiarRol && (
        <Confirmar
          titulo={aCambiarRol.rol === 'admin' ? 'Quitar rol de administrador' : 'Convertir en administrador'}
          mensaje={
            aCambiarRol.rol === 'admin' ? (
              <>
                <strong>{aCambiarRol.indicador}</strong> pasará a ser analista y perderá el acceso a usuarios, actividades técnicas y a todos los equipos.
              </>
            ) : (
              <>
                <strong>{aCambiarRol.indicador}</strong> podrá gestionar usuarios y actividades técnicas, y modificar todos los equipos.
              </>
            )
          }
          textoAccion={aCambiarRol.rol === 'admin' ? 'Quitar rol' : 'Convertir en administrador'}
          ocupado={ocupado}
          onConfirmar={cambiarRol}
          onCancelar={() => setACambiarRol(null)}
        />
      )}

      {clavePara && (
        <Modal
          titulo={`Restablecer clave — ${clavePara.indicador}`}
          onCerrar={cerrar}
          pie={
            <>
              <button className="btn" onClick={cerrar}>
                Cancelar
              </button>
              <button className="btn primario" form="form-clave" disabled={ocupado}>
                Restablecer
              </button>
            </>
          }
        >
          <form id="form-clave" onSubmit={guardarClave} noValidate>
            {errorModal && !campos.clave && <Aviso>{errorModal}</Aviso>}
            <Campo etiqueta="Nueva clave" error={campos.clave} ayuda="Mínimo 8 caracteres. Comunícala al usuario por un medio seguro.">
              <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="new-password" autoFocus />
            </Campo>
          </form>
        </Modal>
      )}
    </>
  );
}
