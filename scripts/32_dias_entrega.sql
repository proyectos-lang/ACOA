-- ============================================================
-- Script 32: dias de entrega para calcular la fecha estimada
-- Se registra un numero de dias y la fecha estimada de entrega se
-- calcula automaticamente a partir de la fecha de entrega del lote,
-- sin contar domingos.
-- ============================================================

ALTER TABLE vanessa.estampacion
  ADD COLUMN IF NOT EXISTS dias_entrega INTEGER;

ALTER TABLE vanessa.confeccion
  ADD COLUMN IF NOT EXISTS dias_entrega INTEGER;

-- Tambien por prenda en OPs tipo conjunto
ALTER TABLE vanessa.lote_prenda
  ADD COLUMN IF NOT EXISTS est_dias_entrega  INTEGER,
  ADD COLUMN IF NOT EXISTS conf_dias_entrega INTEGER;
