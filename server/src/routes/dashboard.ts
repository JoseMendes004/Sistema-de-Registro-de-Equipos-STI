import { Router } from 'express';
import { pool } from '../db.ts';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (req, res) => {
  const dias = [7, 14, 30, 90].includes(Number(req.query.dias)) ? Number(req.query.dias) : 30;
  const [contadores, diario, porAnalista] = await Promise.all([
    pool.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE estado NOT IN ('Entregado', 'Retirado'))::int AS en_laboratorio,
              count(*) FILTER (WHERE estado IN ('En revisión', 'En proceso'))::int AS en_proceso,
              count(*) FILTER (WHERE estado = 'Listo para entregar')::int AS listos,
              count(*) FILTER (WHERE estado = 'Entregado')::int AS entregados,
              count(*) FILTER (WHERE estado IN ('Recibido', 'Pendiente'))::int AS pendientes
         FROM equipos`,
    ),
    pool.query(
      `SELECT to_char(d::date, 'YYYY-MM-DD') AS dia,
              (SELECT count(*)::int FROM equipos e WHERE e.fecha_ingreso::date = d::date) AS ingresos,
              (SELECT count(*)::int FROM salidas s WHERE s.fecha_salida::date = d::date) AS entregas
         FROM generate_series(current_date - ($1::int - 1), current_date, interval '1 day') AS d
        ORDER BY d`,
      [dias],
    ),
    pool.query(
      `SELECT u.nombre || ' ' || u.apellido AS analista, count(*)::int AS total,
              count(*) FILTER (WHERE e.estado IN ('En revisión', 'En proceso'))::int AS en_proceso,
              count(*) FILTER (WHERE e.estado = 'Listo para entregar')::int AS listos
         FROM equipos e JOIN usuarios u ON u.id = e.analista_id
        GROUP BY u.id ORDER BY total DESC, analista`,
    ),
  ]);
  res.json({
    contadores: contadores.rows[0],
    diario: diario.rows,
    por_analista: porAnalista.rows,
  });
});
