-- Tipo de equipo y sistema operativo: con la MAC forman el nombre del equipo.
-- Los equipos anteriores quedan sin estos datos (NULL) hasta que se editen.
ALTER TABLE equipos ADD COLUMN tipo_equipo TEXT CHECK (tipo_equipo IN ('PORTATIL', 'ESCRITORIO'));
ALTER TABLE equipos ADD COLUMN sistema_operativo TEXT CHECK (sistema_operativo IN ('WINDOWS_10', 'WINDOWS_11', 'LINUX'));
