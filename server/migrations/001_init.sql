-- Esquema inicial del Sistema de Registro de Equipos — STI

CREATE TABLE usuarios (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  apellido    TEXT NOT NULL,
  indicador   TEXT NOT NULL,
  estacion    TEXT NOT NULL,
  clave_hash  TEXT NOT NULL,
  rol         TEXT NOT NULL DEFAULT 'analista' CHECK (rol IN ('admin', 'analista')),
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usuarios_indicador_uq ON usuarios (lower(indicador));

CREATE SEQUENCE equipos_numero_seq;

CREATE TABLE equipos (
  id                  SERIAL PRIMARY KEY,
  numero_registro     INTEGER NOT NULL UNIQUE DEFAULT nextval('equipos_numero_seq'),
  fecha_ingreso       TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_propietario TEXT NOT NULL,
  etiqueta            TEXT NOT NULL,
  modelo              TEXT NOT NULL,
  mac                 TEXT NOT NULL,
  nombre_equipo       TEXT NOT NULL,
  analista_id         INTEGER NOT NULL REFERENCES usuarios (id),
  estacion            TEXT NOT NULL,
  tipo_disco          TEXT NOT NULL DEFAULT 'NO_ESPECIFICADO'
                      CHECK (tipo_disco IN ('HDD', 'SSD', 'OTRO', 'NO_ESPECIFICADO')),
  capacidad_disco     TEXT NOT NULL DEFAULT '',
  ram                 TEXT NOT NULL DEFAULT '',
  estado              TEXT NOT NULL DEFAULT 'Recibido'
                      CHECK (estado IN ('Recibido', 'En revisión', 'En proceso', 'Pendiente',
                                        'Listo para entregar', 'Entregado', 'Retirado')),
  observaciones       TEXT NOT NULL DEFAULT '',
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER SEQUENCE equipos_numero_seq OWNED BY equipos.numero_registro;
CREATE INDEX equipos_fecha_idx ON equipos (fecha_ingreso DESC);
CREATE INDEX equipos_estado_idx ON equipos (estado);
CREATE INDEX equipos_analista_idx ON equipos (analista_id);

CREATE TABLE actividades (
  id        SERIAL PRIMARY KEY,
  orden     INTEGER NOT NULL,
  nombre    TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT '',
  activa    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE equipo_actividades (
  equipo_id     INTEGER NOT NULL REFERENCES equipos (id) ON DELETE CASCADE,
  actividad_id  INTEGER NOT NULL REFERENCES actividades (id),
  completada    BOOLEAN NOT NULL DEFAULT FALSE,
  completada_en TIMESTAMPTZ,
  analista_id   INTEGER REFERENCES usuarios (id),
  PRIMARY KEY (equipo_id, actividad_id)
);

CREATE TABLE historial_estados (
  id              SERIAL PRIMARY KEY,
  equipo_id       INTEGER NOT NULL REFERENCES equipos (id) ON DELETE CASCADE,
  estado_anterior TEXT,
  estado_nuevo    TEXT NOT NULL,
  analista_id     INTEGER NOT NULL REFERENCES usuarios (id),
  fecha           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX historial_estados_equipo_idx ON historial_estados (equipo_id);

CREATE TABLE salidas (
  id            SERIAL PRIMARY KEY,
  equipo_id     INTEGER NOT NULL UNIQUE REFERENCES equipos (id) ON DELETE CASCADE,
  fecha_salida  TIMESTAMPTZ NOT NULL,
  retirado_por  TEXT NOT NULL,
  observaciones TEXT NOT NULL DEFAULT '',
  analista_id   INTEGER NOT NULL REFERENCES usuarios (id),
  registrado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE historial_modificaciones (
  id          SERIAL PRIMARY KEY,
  equipo_id   INTEGER NOT NULL REFERENCES equipos (id) ON DELETE CASCADE,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios (id),
  tipo        TEXT NOT NULL CHECK (tipo IN ('INGRESO', 'EDICION', 'ACTIVIDAD', 'ESTADO', 'SALIDA')),
  descripcion TEXT NOT NULL,
  detalle     JSONB NOT NULL DEFAULT '{}',
  fecha       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX historial_mod_equipo_idx ON historial_modificaciones (equipo_id, fecha);
