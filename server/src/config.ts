import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

function requerida(nombre: string): string {
  const v = process.env[nombre];
  if (!v) {
    console.error(`Falta la variable ${nombre}. Ejecuta "npm run setup" o crea el archivo .env.`);
    process.exit(1);
  }
  return v;
}

export const config = {
  root,
  port: Number(process.env.API_PORT ?? 4000),
  databaseUrl: requerida('DATABASE_URL'),
  jwtSecret: requerida('JWT_SECRET'),
  zonaHoraria: process.env.ZONA_HORARIA ?? 'America/Caracas',
  registroAbierto: process.env.REGISTRO_ABIERTO !== 'false',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  isProd: process.env.NODE_ENV === 'production',
};
