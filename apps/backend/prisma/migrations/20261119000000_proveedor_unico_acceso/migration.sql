-- Proveedores: nombre sin espacios sobrantes y único sin distinguir
-- mayúsculas ("Embol" = "embol" = " EMBOL ").
UPDATE proveedores SET nombre = regexp_replace(btrim(nombre), '\s+', ' ', 'g');
CREATE UNIQUE INDEX uq_proveedores_nombre ON proveedores (lower(nombre));

-- Contraseña de acceso cambiada desde Ajustes (hash scrypt). Mientras no
-- exista la fila se usa APP_PASSWORD. Borrar la fila restablece esa clave.
CREATE TABLE acceso (
    id              SMALLINT     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    contrasena_hash TEXT         NOT NULL,
    actualizado_en  TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
