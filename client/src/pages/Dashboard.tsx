import { AlertTriangle, CheckCircle2, Computer, LayoutDashboard, PackageCheck, Plus, Warehouse, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, mensajeError } from '../api';
import { GraficoAnalistas, GraficoDiario } from '../charts';
import type { FilaAnalista, PuntoDia } from '../charts';
import { Aviso, Cabecera } from '../components';

interface Datos {
  contadores: Record<'total' | 'en_laboratorio' | 'en_proceso' | 'listos' | 'entregados' | 'pendientes', number>;
  diario: PuntoDia[];
  por_analista: FilaAnalista[];
}

const TARJETAS = [
  { k: 'total', texto: 'Total de equipos registrados', icono: Computer, tono: '' },
  { k: 'en_laboratorio', texto: 'Dentro del laboratorio', icono: Warehouse, tono: '' },
  { k: 'en_proceso', texto: 'En revisión o mantenimiento', icono: Wrench, tono: 'naranja' },
  { k: 'listos', texto: 'Listos para entregar', icono: PackageCheck, tono: 'verde-suave' },
  { k: 'entregados', texto: 'Entregados', icono: CheckCircle2, tono: 'verde' },
  { k: 'pendientes', texto: 'Pendientes de atención', icono: AlertTriangle, tono: 'rojo' },
] as const;

export function Dashboard() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [dias, setDias] = useState(30);

  useEffect(() => {
    const cargar = () =>
      api<Datos>(`/dashboard?dias=${dias}`)
        .then(setDatos)
        .catch((e) => setError(mensajeError(e)));
    cargar();
    // Refresca los indicadores mientras el panel está abierto (otros analistas pueden registrar equipos).
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, [dias]);

  return (
    <>
      <Cabecera
        icono={<LayoutDashboard size={24} />}
        titulo="Panel principal"
        subtitulo="Resumen de la actividad del laboratorio STI."
        acciones={
          <Link to="/equipos/nuevo" className="btn primario">
            <Plus size={16} /> Registrar nuevo equipo
          </Link>
        }
      />
      {error && <Aviso>{error}</Aviso>}

      <div className="tarjetas">
        {TARJETAS.map((t) => (
          <div key={t.k} className={`tarjeta-dato ${t.tono}`}>
            <div className="tarjeta-dato-icono">
              <t.icono size={20} />
            </div>
            <div className="tarjeta-dato-valor">{datos ? datos.contadores[t.k] : '–'}</div>
            <div className="tarjeta-dato-texto">{t.texto}</div>
          </div>
        ))}
      </div>

      <div className="graficos">
        <section className="panel">
          <div className="panel-cabecera">
            <h2>Ingresos y entregas</h2>
            <select className="selector-corto" value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Periodo">
              <option value={7}>Últimos 7 días</option>
              <option value={14}>Últimos 14 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={90}>Últimos 90 días</option>
            </select>
          </div>
          {datos &&
            (datos.diario.some((d) => d.ingresos || d.entregas) ? (
              <GraficoDiario datos={datos.diario} />
            ) : (
              <p className="nota">Sin ingresos ni entregas en este periodo.</p>
            ))}
        </section>
        <section className="panel">
          <h2>Equipos por analista</h2>
          {datos && (datos.por_analista.length ? <GraficoAnalistas datos={datos.por_analista} totalEquipos={datos.contadores.total} /> : <p className="nota">Aún no hay equipos registrados.</p>)}
        </section>
      </div>
    </>
  );
}
