import { Navigate, Route, Routes } from 'react-router-dom';
import { RutaProtegida } from './auth';
import { Layout } from './Layout';
import { Actividades } from './pages/Actividades';
import { Configuracion } from './pages/Configuracion';
import { Dashboard } from './pages/Dashboard';
import { EquipoDetalle } from './pages/EquipoDetalle';
import { EquipoEditar, EquipoNuevo } from './pages/EquipoForm';
import { Equipos } from './pages/Equipos';
import { Login, Registro } from './pages/Acceso';
import { ReporteImprimible } from './pages/ReporteImprimible';
import { Reportes } from './pages/Reportes';
import { Usuarios } from './pages/Usuarios';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route element={<RutaProtegida />}>
        <Route path="/equipos/:id/imprimir" element={<ReporteImprimible />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/equipos" element={<Equipos />} />
          <Route path="/equipos/nuevo" element={<EquipoNuevo />} />
          <Route path="/equipos/:id" element={<EquipoDetalle />} />
          <Route path="/equipos/:id/editar" element={<EquipoEditar />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/configuracion" element={<Configuracion />} />
          <Route element={<RutaProtegida soloAdmin />}>
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/actividades" element={<Actividades />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
