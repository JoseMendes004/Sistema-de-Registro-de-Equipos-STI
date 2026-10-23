-- Un equipo puede tener su salida registrada y seguir abierto hasta completar el 100 % de las actividades.
-- cerrado_en marca el caso cerrado: deja la lista de equipos y pasa a Reportes.
ALTER TABLE equipos ADD COLUMN cerrado_en TIMESTAMPTZ;
-- Los equipos que ya estaban «Entregados» se consideran casos cerrados.
UPDATE equipos SET cerrado_en = COALESCE(actualizado_en, now()) WHERE estado = 'Entregado' AND cerrado_en IS NULL;
CREATE INDEX equipos_cerrado_idx ON equipos (cerrado_en);
