-- ============================================================
-- Script 07: Actualizar unicidad de op_tela
-- Colores: texto libre (no catálogo)
-- NOTA: ejecutar ANTES del script 08
-- ============================================================

-- 1. Limpiar filas con color null o vacío antes de cambiar unicidad
DELETE FROM vanessa.op_tela WHERE color IS NULL OR trim(color) = '';

-- 2. Cambiar unicidad: antes era (orden_id, slot), ahora (orden_id, slot, color)
ALTER TABLE vanessa.op_tela
  DROP CONSTRAINT IF EXISTS op_tela_orden_id_slot_key;

ALTER TABLE vanessa.op_tela
  ADD CONSTRAINT op_tela_orden_slot_color_uq UNIQUE (orden_id, slot, color);
