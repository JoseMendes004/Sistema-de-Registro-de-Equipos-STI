import {
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorUp,
  Settings,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useUsuario } from './auth';
import { LogoElectrico } from './LogoElectrico';

const MENU = [
  { a: '/', texto: 'Dashboard', corto: 'Inicio', icono: LayoutDashboard, fin: true },
  { a: '/equipos/nuevo', texto: 'Registrar Equipo', corto: 'Registrar', icono: MonitorUp, fin: true },
  { a: '/equipos', texto: 'Registro de Equipos', corto: 'Equipos', icono: ClipboardList, fin: false },
  { a: '/usuarios', texto: 'Usuarios', corto: 'Usuarios', icono: Users, admin: true },
  { a: '/actividades', texto: 'Actividades Técnicas', corto: 'Actividades', icono: Wrench, admin: true },
  { a: '/reportes', texto: 'Reportes', corto: 'Reportes', icono: FileBarChart },
  { a: '/configuracion', texto: 'Configuración', corto: 'Ajustes', icono: Settings },
];

export function Marca() {
  return (
    <div className="marca-logo" title="STI · Soporte Técnico Integral">
      <LogoElectrico tamano={62} />
    </div>
  );
}

export function Layout() {
  const usuario = useUsuario();
  const { salir } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setAbierto(false), [pathname]);

  return (
    <div className="app">
      <aside className={`lateral${abierto ? ' abierto' : ''}`}>
        <div className="lateral-cabecera">
          <Marca />
          <button className="btn-icono solo-movil" onClick={() => setAbierto(false)} aria-label="Cerrar menú">
            <X size={18} />
          </button>
        </div>
        <nav className="menu" aria-label="Secciones">
          {MENU.filter((m) => !m.admin || usuario.rol === 'admin').map((m) => (
            <NavLink
              key={m.a}
              to={m.a}
              // "Registro de Equipos" no debe quedar activo mientras se está en "Registrar Equipo".
              className={({ isActive }) =>
                isActive && !(m.a === '/equipos' && pathname === '/equipos/nuevo') ? 'activo' : ''
              }
              end={m.fin}
              title={m.texto}
              aria-label={m.texto}
            >
              <m.icono size={22} />
              <span>{m.corto}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      {abierto && <div className="lateral-velo" onClick={() => setAbierto(false)} />}

      <div className="principal">
        <header className="superior">
          <button className="btn-icono solo-movil" onClick={() => setAbierto(true)} aria-label="Abrir menú">
            <Menu size={20} />
          </button>
          <div className="superior-espacio" />
          <div className="superior-usuario">
            <div className="avatar">{(((usuario.nombre[0] ?? '') + (usuario.apellido[0] ?? '')) || usuario.indicador[0] || '?').toUpperCase()}</div>
            <div className="superior-datos">
              <strong>
                {usuario.nombre} {usuario.apellido}
              </strong>
              <span>
                {usuario.rol === 'admin' ? 'Administrador' : 'Analista'}
                {usuario.estacion && ` · Estación ${usuario.estacion}`}
              </span>
            </div>
            <button className="btn-salir" onClick={salir} title="Cerrar sesión" aria-label="Cerrar sesión">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="contenido">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
