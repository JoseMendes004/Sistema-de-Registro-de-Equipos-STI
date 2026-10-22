-- Configuración general del sistema (por ahora, la paleta de colores que define el administrador).
CREATE TABLE configuracion (
  clave          TEXT PRIMARY KEY,
  valor          JSONB NOT NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
