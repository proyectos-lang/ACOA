-- ============================================================
-- Script 21: base de datos de estampadores
-- Hoja de vida del estampador (módulo administrativo
-- "Estampadores"): datos de contacto, fecha de nacimiento (para
-- futuras alertas de cumpleaños) y foto de la cédula.
-- ============================================================

CREATE TABLE IF NOT EXISTS vanessa.estampador (
  id               SERIAL PRIMARY KEY,
  nombre_completo  TEXT NOT NULL,
  telefono         TEXT,
  celular          TEXT,
  direccion        TEXT,
  barrio           TEXT,
  fecha_nacimiento DATE,
  url_foto_cedula  TEXT,
  activo           BOOLEAN NOT NULL DEFAULT true,
  creado_por       INTEGER REFERENCES vanessa.usuario(id),
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bucket de storage para las fotos de cédula
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', true)
ON CONFLICT (id) DO NOTHING;
