import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.ts';
import { requireAuth } from './middleware/auth.ts';
import { manejadorErrores, noEncontrado } from './middleware/error.ts';
import { actividadesRouter } from './routes/actividades.ts';
import { authRouter } from './routes/auth.ts';
import { dashboardRouter } from './routes/dashboard.ts';
import { equiposRouter } from './routes/equipos.ts';
import { importarRouter } from './routes/importar.ts';
import { reportesRouter } from './routes/reportes.ts';
import { temaRouter } from './routes/tema.ts';
import { usuariosRouter } from './routes/usuarios.ts';

export const app = express();

app.disable('x-powered-by');
if (config.confiarEnProxy) app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

const api = express.Router();
api.use('/auth', authRouter);
api.use('/tema', temaRouter);
api.use(requireAuth);
api.use('/dashboard', dashboardRouter);
api.use('/equipos', equiposRouter);
api.use('/actividades', actividadesRouter);
api.use('/usuarios', usuariosRouter);
api.use('/reportes', reportesRouter);
api.use('/importar', importarRouter);
api.use(noEncontrado);
app.use('/api', api);

// En producción el mismo servidor entrega el frontend compilado (npm run build).
const dist = path.join(config.root, 'client', 'dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(manejadorErrores);
