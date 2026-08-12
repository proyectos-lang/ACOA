-- ============================================================
-- Script 18: confirmación de capas reales en Corte + ruta de
-- estampación opcional
-- - corte_capa_real: capas realmente cortadas por (tela/slot,
--   fila/color, lote), precargadas con la programación; si el
--   cortador modifica un valor debe dejar comentario.
-- - orden_produccion.pasa_estampacion: si es false, al confirmar
--   el corte la OP pasa directo a confección (costura).
-- ============================================================

CREATE TABLE IF NOT EXISTS vanessa.corte_capa_real (
  id                 SERIAL PRIMARY KEY,
  orden_id           INTEGER  NOT NULL REFERENCES vanessa.orden_produccion(id) ON DELETE CASCADE,
  slot               SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 3),
  fila               SMALLINT NOT NULL DEFAULT 0,
  color              TEXT     NOT NULL,
  lote_nombre        TEXT     NOT NULL,
  capas_programadas  INTEGER  NOT NULL DEFAULT 0,
  capas_reales       INTEGER  NOT NULL DEFAULT 0,
  comentario         TEXT,
  creado_por         INTEGER REFERENCES vanessa.usuario(id),
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(orden_id, slot, fila, lote_nombre)
);

ALTER TABLE vanessa.orden_produccion
  ADD COLUMN IF NOT EXISTS pasa_estampacion BOOLEAN NOT NULL DEFAULT true;
