-- ============================================================
-- Script 23: base de datos de confeccionistas + fecha estimada
-- en confección (réplica del sistema de estampación)
-- - Tabla confeccionista: hoja de vida (módulo administrativo
--   "Confeccionistas")
-- - confeccion.fecha_estimada_entrega: alimenta las alertas de
--   vencimiento del listado de Confección
-- ============================================================

CREATE TABLE IF NOT EXISTS vanessa.confeccionista (
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

ALTER TABLE vanessa.confeccion
  ADD COLUMN IF NOT EXISTS fecha_estimada_entrega DATE;
