import { ArrowLeft, HardDrive, MemoryStick, MonitorUp, Pencil, Save, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, camposError, mensajeError } from '../api';
import { useUsuario } from '../auth';
import { Aviso, Cabecera, Campo } from '../components';
import type { DetalleEquipo, Equipo, SistemaOperativo, TipoDisco, TipoEquipo } from '../types';
import { CAPACIDADES, DISCOS, MEMORIAS, SISTEMAS, TIPOS_EQUIPO, nombreEquipo, numeroRegistro } from '../util';

interface Formulario {
  usuario_propietario: string;
  etiqueta: string;
  modelo: string;
  mac: string;
  tipo_equipo: TipoEquipo | '';
  sistema_operativo: SistemaOperativo | '';
  tipo_disco: TipoDisco;
  capacidad_disco: string;
  ram: string;
  observaciones: string;
}

const VACIO: Formulario = {
  usuario_propietario: '',
  etiqueta: '',
  modelo: '',
  mac: '',
  tipo_equipo: '',
  sistema_operativo: '',
  tipo_disco: 'NO_ESPECIFICADO',
  capacidad_disco: '',
  ram: '',
  observaciones: '',
};

const MAC_RE = /^[0-9A-Fa-f]{2}([-:.]?[0-9A-Fa-f]{2}){5}$/;

/** Nombre del equipo según lo elegido; vacío mientras falte el tipo, el sistema o una MAC válida. */
const nombreGenerado = (f: Formulario) => (MAC_RE.test(f.mac.trim()) ? nombreEquipo(f.sistema_operativo, f.tipo_equipo, f.mac) : '');

/** Botones de opción con una entrada libre cuando se elige "Otra capacidad". */
function OpcionesConOtra({
  opciones,
  valor,
  onChange,
  nombre,
}: {
  opciones: string[];
  valor: string;
  onChange: (v: string) => void;
  nombre: string;
}) {
  const [otra, setOtra] = useState(valor !== '' && !opciones.includes(valor));
  return (
    <div>
      <div className="opciones" role="radiogroup" aria-label={nombre}>
        {opciones.map((o) => (
          <button
            type="button"
            key={o}
            role="radio"
            aria-checked={!otra && valor === o}
            className={`opcion${!otra && valor === o ? ' activa' : ''}`}
            onClick={() => {
              setOtra(false);
              onChange(valor === o && !otra ? '' : o);
            }}
          >
            {o}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={otra}
          className={`opcion${otra ? ' activa' : ''}`}
          onClick={() => {
            setOtra(true);
            onChange('');
          }}
        >
          Otra capacidad
        </button>
      </div>
      {otra && (
        <input
          className="opcion-otra"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ej.: 750 GB"
          maxLength={30}
          aria-label={`${nombre} (otra capacidad)`}
          autoFocus
        />
      )}
    </div>
  );
}

function FormularioEquipo({ inicial, equipo }: { inicial: Formulario; equipo?: Equipo }) {
  const usuario = useUsuario();
  const navigate = useNavigate();
  const [f, setF] = useState(inicial);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cambiar = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setF((x) => ({ ...x, [k]: v }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const c: Record<string, string> = {};
    if (!f.usuario_propietario.trim()) c.usuario_propietario = 'El usuario es obligatorio.';
    if (!f.etiqueta.trim()) c.etiqueta = 'La etiqueta es obligatoria.';
    if (!f.modelo.trim()) c.modelo = 'El modelo es obligatorio.';
    if (!f.mac.trim()) c.mac = 'La dirección MAC es obligatoria.';
    else if (!MAC_RE.test(f.mac.trim())) c.mac = 'MAC inválida. Formato esperado: 00-34-7E-0F-E8-38.';
    if (!f.tipo_equipo) c.tipo_equipo = 'Elige el tipo de equipo.';
    if (!f.sistema_operativo) c.sistema_operativo = 'Elige el sistema operativo.';
    setCampos(c);
    setError('');
    if (Object.keys(c).length) {
      setError('Revisa los campos marcados.');
      return;
    }
    setOcupado(true);
    try {
      const r = await api<{ equipo: Equipo }>(equipo ? `/equipos/${equipo.id}` : '/equipos', {
        method: equipo ? 'PUT' : 'POST',
        body: { ...f, nombre_equipo: undefined },
      });
      navigate(`/equipos/${r.equipo.id}`, { state: { aviso: equipo ? 'Cambios guardados.' : 'Equipo registrado. Ya puedes marcar las actividades.' } });
    } catch (err) {
      setError(mensajeError(err));
      setCampos(camposError(err));
      setOcupado(false);
    }
  }

  const texto = (k: 'usuario_propietario' | 'etiqueta' | 'modelo' | 'mac', etiqueta: string, ayuda?: string, placeholder?: string) => (
    <Campo etiqueta={etiqueta} error={campos[k]} ayuda={ayuda}>
      <input value={f[k]} onChange={(e) => cambiar(k, e.target.value)} placeholder={placeholder} maxLength={120} />
    </Campo>
  );

  return (
    <form onSubmit={enviar} noValidate className="formulario">
      {error && <Aviso>{error}</Aviso>}

      <section className="panel">
        <h2 className="seccion-titulo">
          <span>A</span> Información del cliente y del equipo
        </h2>
        <div className="rejilla tres">
          {texto('usuario_propietario', 'Usuario', 'Cliente, propietario o responsable del equipo.')}
          {texto('etiqueta', 'Etiqueta', 'Código de identificación del equipo.')}
          {texto('modelo', 'Modelo del equipo', undefined, 'Ej.: Lenovo 8910')}
          {texto('mac', 'Dirección MAC', undefined, '00-34-7E-0F-E8-38')}
          <Campo etiqueta="Tipo de equipo" error={campos.tipo_equipo}>
            <select value={f.tipo_equipo} onChange={(e) => cambiar('tipo_equipo', e.target.value as TipoEquipo | '')}>
              <option value="">Seleccionar…</option>
              {TIPOS_EQUIPO.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Sistema operativo" error={campos.sistema_operativo}>
            <select value={f.sistema_operativo} onChange={(e) => cambiar('sistema_operativo', e.target.value as SistemaOperativo | '')}>
              <option value="">Seleccionar…</option>
              {SISTEMAS.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Nombre del equipo" ayuda="Sistema operativo + tipo + últimos 6 dígitos de la MAC.">
            <input className="nombre-generado" value={nombreGenerado(f)} placeholder="Se genera automáticamente" readOnly tabIndex={-1} />
          </Campo>
        </div>
      </section>

      <div className="rejilla dos">
        <section className="panel">
          <h2 className="seccion-titulo">
            <span>B</span> Información del analista
          </h2>
          <div className="ficha">
            <UserRound size={18} />
            <dl>
              <div>
                <dt>Analista</dt>
                <dd>{equipo ? equipo.analista : `${usuario.nombre} ${usuario.apellido}`}</dd>
              </div>
              <div>
                <dt>Indicador</dt>
                <dd>{equipo ? equipo.analista_indicador : usuario.indicador}</dd>
              </div>
              <div>
                <dt>Estación</dt>
                <dd>{equipo ? equipo.estacion : usuario.estacion}</dd>
              </div>
            </dl>
          </div>
          <p className="nota">Se completa automáticamente con la sesión iniciada; no se puede modificar.</p>
        </section>

        <section className="panel">
          <h2 className="seccion-titulo">
            <span>C</span> Información del registro
          </h2>
          <div className="ficha">
            <dl>
              <div>
                <dt>N° de registro</dt>
                <dd>{equipo ? numeroRegistro(equipo.numero_registro) : 'Se asigna al guardar'}</dd>
              </div>
              <div>
                <dt>Fecha y hora de ingreso</dt>
                <dd>{equipo ? new Date(equipo.fecha_ingreso).toLocaleString('es-VE') : 'Al momento de guardar'}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{equipo ? equipo.estado : 'Recibido'}</dd>
              </div>
            </dl>
          </div>
          <p className="nota">Datos generados por el sistema.</p>
        </section>
      </div>

      <section className="panel">
        <h2 className="seccion-titulo">
          <span>D</span> Características del almacenamiento
        </h2>
        <div className="campo">
          <span className="campo-etiqueta">Tipo de disco</span>
          <div className="opciones grandes" role="radiogroup" aria-label="Tipo de disco">
            {DISCOS.map((d) => (
              <button
                type="button"
                key={d.valor}
                role="radio"
                aria-checked={f.tipo_disco === d.valor}
                className={`opcion${f.tipo_disco === d.valor ? ' activa' : ''}`}
                onClick={() => cambiar('tipo_disco', d.valor)}
              >
                <HardDrive size={18} />
                <strong>{d.nombre}</strong>
                <small>{d.detalle}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="campo">
          <span className="campo-etiqueta">Capacidad del disco</span>
          <OpcionesConOtra opciones={CAPACIDADES} valor={f.capacidad_disco} onChange={(v) => cambiar('capacidad_disco', v)} nombre="Capacidad del disco" />
        </div>
      </section>

      <section className="panel">
        <h2 className="seccion-titulo">
          <span>E</span> Memoria RAM <MemoryStick size={16} />
        </h2>
        <OpcionesConOtra opciones={MEMORIAS} valor={f.ram} onChange={(v) => cambiar('ram', v)} nombre="Memoria RAM" />
      </section>

      <section className="panel">
        <Campo etiqueta="Observaciones (opcional)" error={campos.observaciones}>
          <textarea value={f.observaciones} onChange={(e) => cambiar('observaciones', e.target.value)} rows={3} maxLength={2000} />
        </Campo>
      </section>

      <div className="acciones-formulario">
        <Link to={equipo ? `/equipos/${equipo.id}` : '/equipos'} className="btn">
          Cancelar
        </Link>
        <button className="btn primario" disabled={ocupado}>
          <Save size={16} /> {ocupado ? 'Guardando…' : equipo ? 'Guardar cambios' : 'Guardar registro'}
        </button>
      </div>
    </form>
  );
}

export function EquipoNuevo() {
  return (
    <>
      <Cabecera
        icono={<MonitorUp size={24} />}
        titulo="Registrar equipo"
        subtitulo="Ingreso de un equipo al laboratorio STI."
      />
      <FormularioEquipo inicial={VACIO} />
    </>
  );
}

export function EquipoEditar() {
  const { id } = useParams();
  const [detalle, setDetalle] = useState<DetalleEquipo | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<DetalleEquipo>(`/equipos/${id}`)
      .then(setDetalle)
      .catch((e) => setError(mensajeError(e)));
  }, [id]);

  const e = detalle?.equipo;
  return (
    <>
      <Cabecera
        icono={<Pencil size={24} />}
        titulo={e ? `Editar registro ${numeroRegistro(e.numero_registro)}` : 'Editar registro'}
        subtitulo="Los cambios quedan anotados en el historial del equipo."
        acciones={
          <Link to={`/equipos/${id}`} className="btn">
            <ArrowLeft size={16} /> Volver
          </Link>
        }
      />
      {error && <Aviso>{error}</Aviso>}
      {detalle && !detalle.puede_editar && <Aviso>No tienes permiso para editar este registro.</Aviso>}
      {e && detalle.puede_editar && (
        <FormularioEquipo
          equipo={e}
          inicial={{
            usuario_propietario: e.usuario_propietario,
            etiqueta: e.etiqueta,
            modelo: e.modelo,
            mac: e.mac,
            tipo_equipo: e.tipo_equipo ?? '',
            sistema_operativo: e.sistema_operativo ?? '',
            tipo_disco: e.tipo_disco,
            capacidad_disco: e.capacidad_disco,
            ram: e.ram,
            observaciones: e.observaciones,
          }}
        />
      )}
    </>
  );
}
