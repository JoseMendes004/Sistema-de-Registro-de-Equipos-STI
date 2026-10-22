-- Al eliminar un usuario no se borra su fila: se marca como eliminado, pierde la clave y deja de
-- aparecer/poder entrar, pero sus equipos e historial conservan su nombre. El indicador queda libre.
ALTER TABLE usuarios ADD COLUMN eliminado_en TIMESTAMPTZ;
DROP INDEX usuarios_indicador_uq;
CREATE UNIQUE INDEX usuarios_indicador_uq ON usuarios (lower(indicador)) WHERE eliminado_en IS NULL;
