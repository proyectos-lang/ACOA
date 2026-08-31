-- ============================================================
-- Script 25: precio por prenda en OPs tipo Conjunto
-- Cada prenda del conjunto tiene su propio precio de estampación
-- y de confección (los datos se capturan por prenda dentro de
-- "Datos de estampación" / "Datos de confección").
-- ============================================================

ALTER TABLE vanessa.lote_prenda
  ADD COLUMN IF NOT EXISTS est_precio  NUMERIC,
  ADD COLUMN IF NOT EXISTS conf_precio NUMERIC;
