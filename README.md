# Sistema de Registro de Equipos — STI

Sistema de control de ingreso, mantenimiento y entrega de equipos informáticos del Laboratorio de Soporte Técnico Integral. Digitaliza la pizarra de seguimiento: registro de equipos, checklist de actividades, estados, entrega, historial y reportes.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + TypeScript (`client/`) |
| Backend | Node.js 24 + Express 5 (`server/`), validación con zod, sesión JWT en cookie `httpOnly`, claves con bcrypt |
| Base de datos | PostgreSQL 16 en Docker (volumen persistente `sti_pgdata`) |

## Requisitos (Windows)

1. **Node.js 24 o superior** — <https://nodejs.org> (el servidor ejecuta TypeScript directamente, por eso hace falta esta versión).
2. **Docker Desktop** — <https://www.docker.com/products/docker-desktop>. Debe estar **abierto** antes de usar la base de datos.

## Instalación y primera ejecución

Abre PowerShell en la carpeta del proyecto y ejecuta, en orden:

```bash
npm install
```

```bash
npm run setup
```

Crea el archivo `.env` con una clave de base de datos y un secreto de sesión aleatorios.

```bash
npm run db:up
```

Descarga y arranca PostgreSQL (puerto local 5433).

```bash
npm run migrate
```

Crea las tablas y carga las 19 actividades de la pizarra.

```bash
npm run create-admin
```

Crea el **administrador inicial**. El comando pregunta el indicador, el nombre y la clave por consola (la clave no se muestra ni queda escrita en ningún archivo). Mínimo 8 caracteres. Si el indicador ya existe, lo convierte en administrador y le cambia la clave; sirve también para recuperar el acceso.

```bash
npm run seed
```

*(Opcional)* Carga datos de prueba: 4 analistas y 12 equipos en distintos estados. La clave de esos analistas se genera al azar y se muestra **una sola vez** en la consola (o define antes la variable `SEED_CLAVE` para elegirla). Solo se ejecuta si aún no hay equipos.

```bash
npm run dev
```

Abre <http://localhost:5173> e inicia sesión.

## Uso diario

1. Abrir Docker Desktop.
2. `npm run db:up` (si el contenedor no está ya en marcha; se reinicia solo con Docker).
3. `npm run dev`.

Flujo: iniciar sesión → **Registrar Equipo** → marcar actividades en el detalle → actualizar el estado → **Registrar salida** (pide confirmación y deja el equipo como «Entregado»).

## Roles

| | Analista | Administrador |
|---|---|---|
| Registrar y consultar equipos, reportes | ✔ | ✔ |
| Marcar actividades, cambiar estado, registrar salida | En cualquier equipo | En cualquier equipo |
| Editar registros | Cualquiera, hasta la entrega | Todos |
| Eliminar registros | — | ✔ |
| Gestionar usuarios (rol, clave, eliminar con confirmación de clave) | — | ✔ |
| Gestionar actividades técnicas | — | ✔ |

Quien se registra desde la pantalla de registro entra como **analista**. Para impedir el registro libre, pon `REGISTRO_ABIERTO=false` en `.env`.

## Copias de seguridad

```bash
npm run backup
```

Genera `backups/sti_AAAA-MM-DD-hh-mm-ss.sql` con todos los datos (`pg_dump`). Copia esa carpeta a otro disco o a la red con regularidad.

Para restaurar (reemplaza los datos actuales por los del archivo):

```bash
npm run restore -- backups/sti_2026-10-01-08-00-00.sql
```

Para automatizarlo, crea en el *Programador de tareas* de Windows una tarea diaria que ejecute `npm run backup` en la carpeta del proyecto.

## Estructura

```
├─ docker-compose.yml        PostgreSQL
├─ .env.example              Variables de entorno (plantilla)
├─ scripts/                  setup, backup, restore
├─ server/
│  ├─ migrations/            001_init.sql (esquema), 002_seed_actividades.sql
│  ├─ scripts/               migrate, seed, create-admin
│  └─ src/
│     ├─ app.ts  index.ts  config.ts  db.ts
│     ├─ middleware/         auth (sesión y roles), validate, error
│     ├─ routes/             auth, usuarios, equipos, actividades, dashboard, reportes
│     └─ services/           equipos.service (consultas e historial), export.service (CSV/Excel)
└─ client/src/
   ├─ App.tsx  Layout.tsx  auth.tsx  api.ts  components.tsx  styles.css
   └─ pages/                 Acceso (login/registro), Dashboard, EquipoForm, Equipos, EquipoDetalle,
                             ReporteImprimible, Reportes, Usuarios, Actividades, Configuracion
```

## Base de datos

| Tabla | Contenido |
|---|---|
| `usuarios` | Analistas y administradores (indicador único, clave en hash, rol, estado) |
| `equipos` | Registro de cada equipo; `numero_registro` correlativo; `analista_id` → `usuarios` |
| `actividades` | Catálogo configurable de tareas (orden, nombre, categoría, activa) |
| `equipo_actividades` | Actividades realizadas por equipo, con fecha y analista |
| `historial_estados` | Cada cambio de estado |
| `salidas` | Entrega: fecha, quién retira, observaciones, analista |
| `historial_modificaciones` | Bitácora de ingreso, ediciones, actividades, estados y salida (línea de tiempo) |

## Montarlo en un servidor

1. Instalar Node 24 y Docker en el servidor; copiar el proyecto (sin `node_modules`).
2. `npm install`, `npm run setup`, `npm run db:up`, `npm run migrate`, `npm run create-admin`.
3. `npm run build` — compila el frontend en `client/dist`.
4. Arrancar con `NODE_ENV=production` y `npm start`: el mismo proceso sirve la API y el frontend en el puerto `API_PORT` (4000).
5. Ponerlo detrás de HTTPS (IIS, Nginx o Caddy como proxy inverso) y entonces definir `COOKIE_SECURE=true` en `.env`.
6. Programar `npm run backup` a diario.

Para trasladar los datos de la PC al servidor: `npm run backup` en la PC y `npm run restore -- archivo.sql` en el servidor.

## Control de versiones

Esta carpeta está dentro de un repositorio git cuya raíz es la carpeta de usuario. Para versionar solo el proyecto, ejecuta `git init` aquí. El archivo `.env` y `backups/` ya están excluidos en `.gitignore`.
