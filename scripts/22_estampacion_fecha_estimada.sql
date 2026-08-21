-- ============================================================
-- Script 22: fecha estimada de entrega en estampación
-- Fecha en la que el estampador debe devolver el lote; alimenta
-- las alertas de proximidad de vencimiento en el listado.
-- ============================================================

ALTER TABLE vanessa.estampacion
  ADD COLUMN IF NOT EXISTS fecha_estimada_entrega DATE;
