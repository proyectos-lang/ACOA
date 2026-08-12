-- ============================================================
-- Script 16: categoría de la orden de producción
-- Catálogo de categorías (creables desde la pestaña General de la
-- OP) y campo categoria_id en orden_produccion.
-- ============================================================

CREATE TABLE IF NOT EXISTS vanessa.categoria (
  id         SERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL UNIQUE,
  creado_por INTEGER REFERENCES vanessa.usuario(id),
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vanessa.orden_produccion
  ADD COLUMN IF NOT EXISTS categoria_id INTEGER REFERENCES vanessa.categoria(id);
