import { Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, mensajeError } from '../api';
import type { DetalleEquipo } from '../types';
import { DISCOS, fechaHora, numeroRegistro, porcentaje } from '../util';

export function ReporteImprimible() {
  const { id } = useParams();
  const [d, setD] = useState<DetalleEquipo | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<DetalleEquipo>(`/equipos/${id}`)
      .then(setD)
      .catch((e) => setError(mensajeError(e)));
  }, [id]);

  if (!d) return <div className="hoja">{error || 'Cargando…'}</div>;
  const e = d.equipo;
  const hechas = d.actividades.filter((a) => a.completada && a.activa).length;

  const fila = (a: string, b: string | null | undefined) => (
    <tr>
      <th>{a}</th>
      <td>{b || '—'}</td>
    </tr>
  );

  return (
    <div className="hoja">
      <div className="hoja-barra no-imprimir">
        <Link to={`/equipos/${e.id}`}>← Volver al detalle</Link>
        <button onClick={() => window.print()}>
          <Printer size={15} /> Imprimir
        </button>
      </div>

      <header className="hoja-cabecera">
        <div>
          <h1>Sistema de Registro de Equipos — STI</h1>
          <p>Laboratorio de Soporte Técnico Integral · Reporte de equipo</p>
        </div>
        <div className="hoja-numero">
          N° {numeroRegistro(e.numero_registro)}
          <small>{e.estado}</small>
        </div>
      </header>

      <h2>Datos del equipo</h2>
      <table className="hoja-tabla">
        <tbody>
          {fila('Usuario / Propietario', e.usuario_propietario)}
          {fila('Etiqueta', e.etiqueta)}
          {fila('Modelo', e.modelo)}
          {fila('Dirección MAC', e.mac)}
          {fila('Nombre del equipo', e.nombre_equipo)}
          {fila('Disco', `${DISCOS.find((x) => x.valor === e.tipo_disco)?.detalle ?? ''} ${e.capacidad_disco}`.trim())}
          {fila('Memoria RAM', e.ram)}
          {fila('Fecha de ingreso', fechaHora(e.fecha_ingreso))}
          {fila('Analista responsable', `${e.analista} (${e.analista_indicador}) · Estación ${e.estacion}`)}
          {fila('Observaciones', e.observaciones)}
        </tbody>
      </table>

      <h2>
        Actividades realizadas — {hechas}/{d.total_actividades} ({porcentaje(hechas, d.total_actividades)}%)
      </h2>
      <table className="hoja-tabla hoja-actividades">
        <thead>
          <tr>
            <th>N°</th>
            <th>Actividad</th>
            <th>Hecha</th>
            <th>Fecha</th>
            <th>Analista</th>
          </tr>
        </thead>
        <tbody>
          {d.actividades.map((a, i) => (
            <tr key={a.id}>
              <td>{String(i + 1).padStart(2, '0')}</td>
              <td>{a.nombre}</td>
              <td>{a.completada ? '☑' : '☐'}</td>
              <td>{a.completada ? fechaHora(a.completada_en) : ''}</td>
              <td>{a.completada ? a.analista : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Entrega</h2>
      {e.fecha_salida ? (
        <table className="hoja-tabla">
          <tbody>
            {fila('Fecha y hora de salida', fechaHora(e.fecha_salida))}
            {fila('Retirado por', e.retirado_por)}
            {fila('Entregado por', e.entregado_por)}
            {fila('Observaciones', e.salida_observaciones)}
          </tbody>
        </table>
      ) : (
        <p>El equipo aún no ha sido entregado.</p>
      )}

      <div className="hoja-firmas">
        <div>Analista responsable</div>
        <div>Recibe conforme</div>
      </div>
    </div>
  );
}
