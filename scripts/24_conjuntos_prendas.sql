-- ============================================================
-- Script 24: OPs tipo Conjunto con gestión por prenda
-- - orden_produccion.tipo_prenda: 'prenda' (una sola prenda, flujo
--   normal) o 'conjunto' (varias prendas por lote)
-- - lote_prenda: cada prenda de un conjunto dentro de un lote, con
--   su propio estampador, confeccionista, fechas, conteo y estado,
--   para gestionar y visualizar cada prenda por separado.
-- ============================================================

ALTER TABLE vanessa.orden_produccion
  ADD COLUMN IF NOT EXISTS tipo_prenda TEXT NOT NULL DEFAULT 'prenda'
    CHECK (tipo_prenda IN ('prenda', 'conjunto'));

CREATE TABLE IF NOT EXISTS vanessa.lote_prenda (
  id                    SERIAL PRIMARY KEY,
  lote_id               INTEGER NOT NULL REFERENCES vanessa.lote(id) ON DELETE CASCADE,
  nombre                TEXT NOT NULL,
  estado                TEXT NOT NULL DEFAULT 'estampacion'
                          CHECK (estado IN ('estampacion', 'confeccion', 'conteo', 'completado')),
  -- Estampación por prenda
  nombre_estampador     TEXT,
  est_fecha_entrega     DATE,
  est_fecha_estimada    DATE,
  est_fecha_retorno     DATE,
  -- Confección por prenda
  nombre_confeccionista TEXT,
  conf_fecha_entrega    DATE,
  conf_fecha_estimada   DATE,
  conf_fecha_retorno    DATE,
  -- Conteo por prenda
  cantidad_contada      INTEGER,
  creado_por            INTEGER REFERENCES vanessa.usuario(id),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lote_prenda_lote_id ON vanessa.lote_prenda(lote_id);
