import { ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, camposError, mensajeError } from '../api';
import { useAuth } from '../auth';
import { Aviso, Campo } from '../components';
import ElectricLogo from '../ElectricLogo';
import { useLogoSti } from '../logoSti';
import { hexDeTono, useTemaActual } from '../tema';

/** El efecto solo se dibuja en pantallas anchas y si el usuario no pidió reducir el movimiento. */
function useEfectoActivo() {
  const consulta = '(min-width: 901px) and (prefers-reduced-motion: no-preference)';
  const [activo, setActivo] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const m = window.matchMedia(consulta);
    const cambiar = () => setActivo(m.matches);
    m.addEventListener('change', cambiar);
    return () => m.removeEventListener('change', cambiar);
  }, []);
  return activo;
}

function MarcoAcceso({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  const efecto = useEfectoActivo();
  const logo = useLogoSti(efecto);
  const tema = useTemaActual();
  return (
    <div className="acceso">
      <section className="acceso-panel">
        {efecto && (
          <div className="acceso-logo">
            {logo && <ElectricLogo src={logo} color="#ffffff" glowColor={hexDeTono(tema.h, 100 * tema.s, 50)} scale={0.8} speed={1.2} bend={0.4} crackle={1} maxFps={60} maxDpr={2} pixelBudget={2.5e6} interactive />}
          </div>
        )}
        <div className="acceso-bienvenida">
          <h2>
            Registro de <em>Equipos</em>
          </h2>
          <p>Sistema de control de ingreso, mantenimiento y entrega de equipos informáticos.</p>
        </div>
        <small>Laboratorio de Soporte Técnico Integral</small>
      </section>
      <section className="acceso-zona">
        <div className="acceso-tarjeta">
          <h1>{titulo}</h1>
          <p className="acceso-sub">{subtitulo}</p>
          {children}
        </div>
        <p className="acceso-nota">
          <ShieldCheck size={14} /> Las claves se guardan cifradas (hash).
        </p>
      </section>
    </div>
  );
}

function CampoClave({
  etiqueta,
  valor,
  onChange,
  error,
  autoComplete,
  ayuda,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete: string;
  ayuda?: string;
}) {
  const [ver, setVer] = useState(false);
  return (
    <Campo etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <div className="entrada-icono">
        <KeyRound size={16} />
        <input
          type={ver ? 'text' : 'password'}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
        <button type="button" className="btn-icono" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar clave' : 'Mostrar clave'}>
          {ver ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </Campo>
  );
}

export function Login() {
  const { usuario, entrar } = useAuth();
  const location = useLocation();
  const estado = location.state as { desde?: string; registrado?: string } | null;
  const [indicador, setIndicador] = useState(estado?.registrado ?? '');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);
  const [registroAbierto, setRegistroAbierto] = useState(true);

  useEffect(() => {
    api<{ registro_abierto: boolean }>('/auth/config')
      .then((r) => setRegistroAbierto(r.registro_abierto))
      .catch(() => {});
  }, []);

  if (usuario) return <Navigate to={estado?.desde ?? '/'} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setCampos({});
    setOcupado(true);
    try {
      await entrar(indicador, clave);
    } catch (err) {
      setError(mensajeError(err));
      setCampos(camposError(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <MarcoAcceso titulo="Iniciar sesión" subtitulo="Ingresa con tu indicador y tu clave.">
      <form onSubmit={enviar} noValidate>
        {estado?.registrado && !error && <Aviso tipo="ok">Cuenta creada. Ya puedes iniciar sesión.</Aviso>}
        {error && <Aviso>{error}</Aviso>}
        <Campo etiqueta="Indicador" error={campos.indicador}>
          <div className="entrada-icono">
            <UserRound size={16} />
            <input value={indicador} onChange={(e) => setIndicador(e.target.value)} autoComplete="username" autoFocus />
          </div>
        </Campo>
        <CampoClave etiqueta="Clave" valor={clave} onChange={setClave} error={campos.clave} autoComplete="current-password" />
        <button className="btn primario ancho" disabled={ocupado}>
          {ocupado ? 'Verificando…' : 'Iniciar sesión'} <ArrowRight size={16} />
        </button>
      </form>
      {registroAbierto && (
        <p className="acceso-enlace">
          ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
        </p>
      )}
    </MarcoAcceso>
  );
}

const VACIO = { nombre: '', apellido: '', indicador: '', estacion: '', clave: '', confirmacion: '' };

export function Registro() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState(VACIO);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  if (usuario) return <Navigate to="/" replace />;

  const cambiar = (k: keyof typeof VACIO) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const c: Record<string, string> = {};
    if (!f.nombre.trim()) c.nombre = 'El nombre es obligatorio.';
    if (!f.apellido.trim()) c.apellido = 'El apellido es obligatorio.';
    if (!f.indicador.trim()) c.indicador = 'El indicador es obligatorio.';
    if (!f.estacion.trim()) c.estacion = 'La estación de trabajo es obligatoria.';
    if (f.clave.length < 8) c.clave = 'La clave debe tener al menos 8 caracteres.';
    if (f.confirmacion !== f.clave) c.confirmacion = 'La confirmación no coincide con la clave.';
    setCampos(c);
    setError('');
    if (Object.keys(c).length) return;
    setOcupado(true);
    try {
      await api('/auth/registro', { method: 'POST', body: f });
      navigate('/login', { state: { registrado: f.indicador.trim() } });
    } catch (err) {
      setError(mensajeError(err));
      setCampos(camposError(err));
    } finally {
      setOcupado(false);
    }
  }

  const texto = (k: keyof typeof VACIO, etiqueta: string, extra: object = {}) => (
    <Campo etiqueta={etiqueta} error={campos[k]}>
      <input value={f[k]} onChange={(e) => cambiar(k)(e.target.value)} {...extra} />
    </Campo>
  );

  return (
    <MarcoAcceso titulo="Crear cuenta" subtitulo="Registro de analistas y trabajadores del laboratorio.">
      <form onSubmit={enviar} noValidate>
        {error && <Aviso>{error}</Aviso>}
        <div className="rejilla dos">
          {texto('nombre', 'Nombre', { autoComplete: 'given-name', autoFocus: true })}
          {texto('apellido', 'Apellido', { autoComplete: 'family-name' })}
          {texto('indicador', 'Indicador', { autoComplete: 'username' })}
          {texto('estacion', 'Estación de trabajo')}
        </div>
        <CampoClave etiqueta="Clave" valor={f.clave} onChange={cambiar('clave')} error={campos.clave} autoComplete="new-password" ayuda="Mínimo 8 caracteres." />
        <CampoClave etiqueta="Confirmar clave" valor={f.confirmacion} onChange={cambiar('confirmacion')} error={campos.confirmacion} autoComplete="new-password" />
        <button className="btn primario ancho" disabled={ocupado}>
          {ocupado ? 'Registrando…' : 'Registrarme'} <ArrowRight size={16} />
        </button>
      </form>
      <p className="acceso-enlace">
        ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
      </p>
    </MarcoAcceso>
  );
}
