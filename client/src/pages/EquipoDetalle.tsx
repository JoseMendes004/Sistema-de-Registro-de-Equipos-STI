import { ArrowLeft, LogOut, MonitorCog, Pencil, Printer, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, camposError, mensajeError } from '../api';
import { useUsuario } from '../auth';
import { Aviso, Cabecera, Campo, Confirmar, Insignia, Modal, Progreso } from '../components';
import { ESTADOS } from '../types';
import type { ActividadEquipo, DetalleEquipo, Equipo, Estado, Evento } from '../types';
import { ahoraLocal, DISCOS, fechaHora, numeroRegistro } from '../util';

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <dt>{etiqueta}</dt>
      <dd>{children || '—'}</dd>
    </div>
  );
}

function ModalSalida({
  equipo,
  onCerrar,
  onListo,
}: {
  equipo: Equipo;
  onCerrar: () => void;
  onListo: (r: { equipo: Equipo; historial: Evento[] }) => void;
}) {
  const usuario = useUsuario();
  const [fecha, setFecha] = useState(ahoraLocal());
  const [retira, setRetira] = useState(equipo.usuario_propietario);
  const [obs, setObs] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  function revisar(e: FormEvent) {
    e.preventDefault();
    const c: Record<string, string> = {};
    if (!fecha) c.fecha_salida = 'Indica la fecha y hora de salida.';
    if (!retira.trim()) c.retirado_por = 'Indica quién retira el equipo.';
    setCampos(c);
    setError('');
    if (!Object.keys(c).length) setConfirmando(true);
  }

  async function confirmar() {
    setOcupado(true);
    try {
      const r = await api<{ equipo: Equipo; historial: Evento[] }>(`/equipos/${equipo.id}/salida`, {
        method: 'POST',
        body: { fecha_salida: new Date(fecha).toISOString(), retirado_por: retira, observaciones: obs },
      });
      onListo(r);
    } catch (e) {
      setError(mensajeError(e));
      setCampos(camposError(e));
      setConfirmando(false);
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo={confirmando ? 'Confirmar entrega' : `Registrar salida — ${numeroRegistro(equipo.numero_registro)}`}
      onCerrar={onCerrar}
      pie={
        confirmando ? (
          <>
            <button className="btn" onClick={() => setConfirmando(false)} disabled={ocupado}>
              Volver
            </button>
            {/* key distinta: evita que un doble clic en «Continuar» confirme la entrega */}
            <button key="confirmar" className="btn primario" onClick={confirmar} disabled={ocupado}>
              {ocupado ? 'Registrando…' : 'Sí, registrar entrega'}
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={onCerrar}>
              Cancelar
            </button>
            <button key="continuar" className="btn primario" form="form-salida">
              Continuar
            </button>
          </>
        )
      }
    >
      {confirmando ? (
        <div className="confirmar-mensaje">
          <p>
            Vas a registrar la salida del equipo <strong>{equipo.modelo}</strong> (etiqueta {equipo.etiqueta}). El estado
            pasará a <strong>Entregado</strong> y el registro quedará cerrado.
          </p>
          <dl className="datos compactos">
            <Dato etiqueta="Fecha y hora de salida">{fechaHora(new Date(fecha).toISOString())}</Dato>
            <Dato etiqueta="Retira">{retira}</Dato>
            <Dato etiqueta="Entrega">
              {usuario.nombre} {usuario.apellido}
            </Dato>
            <Dato etiqueta="Observaciones">{obs}</Dato>
          </dl>
        </div>
      ) : (
        <form id="form-salida" onSubmit={revisar} noValidate>
          {error && <Aviso>{error}</Aviso>}
          <Campo etiqueta="Fecha y hora de salida" error={campos.fecha_salida}>
            <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Campo>
          <Campo etiqueta="Persona que retira el equipo" error={campos.retirado_por}>
            <input value={retira} onChange={(e) => setRetira(e.target.value)} maxLength={120} />
          </Campo>
          <Campo etiqueta="Observaciones de la entrega" error={campos.observaciones}>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} maxLength={2000} />
          </Campo>
          <Campo etiqueta="Analista responsable de la entrega" ayuda="Se toma de la sesión iniciada.">
            <input value={`${usuario.nombre} ${usuario.apellido} (${usuario.indicador})`} readOnly />
          </Campo>
        </form>
      )}
    </Modal>
  );
}

export function EquipoDetalle() {
  const { id } = useParams();
  const usuario = useUsuario();
  const navigate = useNavigate();
  const [eliminar, setEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [d, setD] = useState<DetalleEquipo | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState((location.state as { aviso?: string } | null)?.aviso ?? '');
  const [estadoSel, setEstadoSel] = useState<Estado>('Recibido');
  const [guardando, setGuardando] = useState<number | 'estado' | null>(null);
  const [salida, setSalida] = useState(false);

  const cargar = useCallback(() => {
    api<DetalleEquipo>(`/equipos/${id}`)
      .then((r) => {
        setD(r);
        setEstadoSel(r.equipo.estado);
        setError('');
      })
      .catch((e) => setError(mensajeError(e)));
  }, [id]);

  useEffect(cargar, [cargar]);

  // Llegada desde la tabla con «Registrar salida» o con el enlace a las actividades.
  useEffect(() => {
    if (!d) return;
    if (params.get('salida') && d.puede_operar) {
      setSalida(true);
      setParams({}, { replace: true });
    }
    if (location.hash === '#actividades') document.getElementById('actividades')?.scrollIntoView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d === null]);

  if (!d) {
    return (
      <>
        <Cabecera icono={<MonitorCog size={24} />} titulo="Detalle del equipo" />
        {error ? <Aviso>{error}</Aviso> : <p className="nota">Cargando…</p>}
      </>
    );
  }

  const e = d.equipo;
  const hechas = d.actividades.filter((a) => a.completada && a.activa).length;

  async function marcar(a: ActividadEquipo) {
    setGuardando(a.id);
    setAviso('');
    try {
      const r = await api<Pick<DetalleEquipo, 'actividades' | 'equipo' | 'historial'>>(
        `/equipos/${e.id}/actividades/${a.id}`,
        { method: 'PUT', body: { completada: !a.completada } },
      );
      setD((x) => x && { ...x, ...r });
      setError('');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(null);
    }
  }

  async function eliminarRegistro() {
    setEliminando(true);
    try {
      await api(`/equipos/${e.id}`, { method: 'DELETE' });
      navigate('/equipos', { replace: true });
    } catch (err) {
      setError(mensajeError(err));
      setEliminar(false);
      setEliminando(false);
    }
  }

  async function cambiarEstado() {
    setGuardando('estado');
    setAviso('');
    try {
      const r = await api<Pick<DetalleEquipo, 'equipo' | 'historial'>>(`/equipos/${e.id}/estado`, {
        method: 'PUT',
        body: { estado: estadoSel },
      });
      setD((x) => x && { ...x, ...r });
      setAviso(`Estado actualizado a «${r.equipo.estado}».`);
      setError('');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(null);
    }
  }

  return (
    <>
      <Cabecera
        icono={<MonitorCog size={24} />}
        titulo={`Registro ${numeroRegistro(e.numero_registro)} — ${e.modelo}`}
        subtitulo={`${e.usuario_propietario} · Etiqueta ${e.etiqueta}`}
        acciones={
          <>
            <Link to="/equipos" className="btn">
              <ArrowLeft size={16} /> Volver
            </Link>
            <Link to={`/equipos/${e.id}/imprimir`} className="btn" target="_blank">
              <Printer size={16} /> Imprimir reporte
            </Link>
            {d.puede_editar && (
              <Link to={`/equipos/${e.id}/editar`} className="btn">
                <Pencil size={16} /> Editar
              </Link>
            )}
            {d.puede_operar && (
              <button className="btn primario" onClick={() => setSalida(true)}>
                <LogOut size={16} /> Registrar salida
              </button>
            )}
            {usuario.rol === 'admin' && (
              <button className="btn peligro" onClick={() => setEliminar(true)}>
                <Trash2 size={16} /> Eliminar
              </button>
            )}
          </>
        }
      />

      {aviso && <Aviso tipo="ok">{aviso}</Aviso>}
      {error && <Aviso>{error}</Aviso>}

      <div className="detalle">
        <div className="detalle-columna">
          <section className="panel">
            <div className="panel-cabecera">
              <h2>Estado actual</h2>
              <Insignia estado={e.estado} />
            </div>
            {d.puede_operar ? (
              <div className="estado-cambio">
                <select value={estadoSel} onChange={(ev) => setEstadoSel(ev.target.value as Estado)} aria-label="Nuevo estado">
                  {ESTADOS.filter((s) => s !== 'Entregado').map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button className="btn" onClick={cambiarEstado} disabled={estadoSel === e.estado || guardando === 'estado'}>
                  Actualizar estado
                </button>
              </div>
            ) : null}
            <p className="nota">
              {e.estado === 'Entregado'
                ? 'El equipo fue entregado; el registro permanece en el historial.'
                : 'El estado «Entregado» se asigna al registrar la salida del equipo.'}
            </p>
          </section>

          <section className="panel">
            <h2>Cliente y equipo</h2>
            <dl className="datos">
              <Dato etiqueta="Usuario / Propietario">{e.usuario_propietario}</Dato>
              <Dato etiqueta="Etiqueta">{e.etiqueta}</Dato>
              <Dato etiqueta="Modelo">{e.modelo}</Dato>
              <Dato etiqueta="Dirección MAC">
                <span className="mono">{e.mac}</span>
              </Dato>
              <Dato etiqueta="Nombre del equipo">
                <span className="mono">{e.nombre_equipo}</span>
              </Dato>
              <Dato etiqueta="Fecha de ingreso">{fechaHora(e.fecha_ingreso)}</Dato>
              <Dato etiqueta="Tipo de disco">{DISCOS.find((x) => x.valor === e.tipo_disco)?.detalle}</Dato>
              <Dato etiqueta="Capacidad del disco">{e.capacidad_disco}</Dato>
              <Dato etiqueta="Memoria RAM">{e.ram}</Dato>
            </dl>
            <h3>Analista responsable</h3>
            <dl className="datos">
              <Dato etiqueta="Nombre">{e.analista}</Dato>
              <Dato etiqueta="Indicador">{e.analista_indicador}</Dato>
              <Dato etiqueta="Estación">{e.estacion}</Dato>
            </dl>
            <h3>Observaciones</h3>
            <p className="texto-libre">{e.observaciones || 'Sin observaciones.'}</p>
          </section>

          {e.fecha_salida && (
            <section className="panel panel-salida">
              <h2>Información de salida</h2>
              <dl className="datos">
                <Dato etiqueta="Fecha y hora de salida">{fechaHora(e.fecha_salida)}</Dato>
                <Dato etiqueta="Retirado por">{e.retirado_por}</Dato>
                <Dato etiqueta="Entregado por">{e.entregado_por}</Dato>
              </dl>
              <h3>Observaciones de la entrega</h3>
              <p className="texto-libre">{e.salida_observaciones || 'Sin observaciones.'}</p>
            </section>
          )}
        </div>

        <div className="detalle-columna">
          <section className="panel" id="actividades">
            <div className="panel-cabecera">
              <h2>Actividades realizadas</h2>
              <div className="progreso-ancho">
                <Progreso hechas={hechas} total={d.total_actividades} />
              </div>
            </div>
            <ul className="checklist">
              {d.actividades.map((a, i) => (
                <li key={a.id} className={a.completada ? 'hecha' : ''}>
                  <label>
                    <input
                      type="checkbox"
                      checked={a.completada}
                      disabled={!d.puede_operar || guardando === a.id}
                      onChange={() => marcar(a)}
                    />
                    <span className="checklist-numero">{String(i + 1).padStart(2, '0')}</span>
                    <span className="checklist-texto">
                      <strong>
                        {a.nombre}
                        {!a.activa && <em> (actividad retirada de la lista)</em>}
                      </strong>
                      <small>
                        {a.completada
                          ? `Realizada el ${fechaHora(a.completada_en)} por ${a.analista}`
                          : a.categoria || 'Sin realizar'}
                      </small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {eliminar && (
        <Confirmar
          titulo="Eliminar registro"
          mensaje={
            <>
              Se eliminará definitivamente el registro <strong>{numeroRegistro(e.numero_registro)}</strong> ({e.modelo}, {e.usuario_propietario}) junto con
              sus actividades, estados y datos de salida. Esta acción no se puede deshacer.
            </>
          }
          textoAccion="Eliminar"
          peligro
          ocupado={eliminando}
          onConfirmar={eliminarRegistro}
          onCancelar={() => setEliminar(false)}
        />
      )}

      {salida && (
        <ModalSalida
          equipo={e}
          onCerrar={() => setSalida(false)}
          onListo={(r) => {
            setSalida(false);
            setAviso('Salida registrada. El equipo quedó como «Entregado».');
            setD((x) => x && { ...x, ...r, puede_operar: false });
            cargar();
          }}
        />
      )}
    </>
  );
}
