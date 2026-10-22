import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { alExpirarSesion, api } from './api';
import type { Usuario } from './types';

interface Auth {
  usuario: Usuario | null;
  cargando: boolean;
  entrar: (indicador: string, clave: string) => Promise<void>;
  salir: () => Promise<void>;
}

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    alExpirarSesion(() => setUsuario(null));
    api<{ usuario: Usuario }>('/auth/yo')
      .then((r) => setUsuario(r.usuario))
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  const entrar = useCallback(async (indicador: string, clave: string) => {
    const r = await api<{ usuario: Usuario }>('/auth/login', { method: 'POST', body: { indicador, clave } });
    setUsuario(r.usuario);
  }, []);

  const salir = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setUsuario(null);
  }, []);

  return <Ctx.Provider value={{ usuario, cargando, entrar, salir }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fuera de AuthProvider');
  return v;
}

/** Usuario de la sesión dentro de rutas protegidas. */
export function useUsuario() {
  return useAuth().usuario!;
}

export function RutaProtegida({ soloAdmin = false }: { soloAdmin?: boolean }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();
  if (cargando) return <div className="pantalla-carga">Cargando…</div>;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname + location.search }} />;
  if (soloAdmin && usuario.rol !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}
