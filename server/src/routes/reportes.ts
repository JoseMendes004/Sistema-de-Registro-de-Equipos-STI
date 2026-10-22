import { Router } from 'express';
import { z } from 'zod';
import { validar } from '../middleware/validate.ts';
import { filtrosSchema, listarEquipos } from '../services/equipos.service.ts';
import { generarCsv, generarXlsx } from '../services/export.service.ts';

export const reportesRouter = Router();

reportesRouter.get('/export', async (req, res) => {
  const { formato, ...resto } = validar(
    filtrosSchema.extend({ formato: z.enum(['csv', 'xlsx']).default('csv') }),
    req.query,
  );
  const { items, total_actividades } = await listarEquipos(resto, false);
  const nombre = `registro_equipos_sti_${new Date().toISOString().slice(0, 10)}`;

  if (formato === 'xlsx') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.xlsx"`);
    await generarXlsx(items, total_actividades).xlsx.write(res);
    res.end();
    return;
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}.csv"`);
  res.send(generarCsv(items, total_actividades));
});
