-- ============================================================
-- Script 28: precios de proceso opcionales a nivel de lote
-- En OPs tipo Conjunto el estampador/confeccionista y el precio se
-- registran POR PRENDA (lote_prenda), así que el registro a nivel de
-- lote (estampacion / confeccion) puede guardarse sin precio.
-- Sin esto, "Guardar estampación" en un lote de conjunto falla con
-- "null value in column precio_estampacion violates not-null".
-- ============================================================

ALTER TABLE vanessa.estampacion ALTER COLUMN precio_estampacion DROP NOT NULL;
ALTER TABLE vanessa.confeccion  ALTER COLUMN precio_confeccion  DROP NOT NULL;
