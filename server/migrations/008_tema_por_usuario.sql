-- Cada usuario tiene su propia paleta de colores y sus paletas guardadas.
ALTER TABLE usuarios ADD COLUMN tema JSONB;
ALTER TABLE usuarios ADD COLUMN paletas JSONB NOT NULL DEFAULT '[]';

-- Los administradores conservan la paleta y las paletas guardadas que ya tenían.
UPDATE usuarios SET
  tema = (SELECT valor FROM configuracion WHERE clave = 'tema'),
  paletas = COALESCE((SELECT valor FROM configuracion WHERE clave = 'paletas'), '[]'::jsonb)
WHERE rol = 'admin';
