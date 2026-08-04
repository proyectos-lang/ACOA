-- ============================================================
-- Script 13: permitir colores repetidos en los materiales de la curva
-- Cada fila de la grilla obtiene un índice `fila`; la identidad de una
-- fila deja de ser el color (que ahora puede repetirse) y pasa a ser
-- su posición. Se eliminan las restricciones de unicidad por color.
-- ============================================================

-- 1. op_tela: columna fila + backfill por orden de inserción
ALTER TABLE vanessa.op_tela
  ADD COLUMN IF NOT EXISTS fila SMALLINT NOT NULL DEFAULT 0;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY orden_id, slot ORDER BY id) - 1 AS rn
  FROM vanessa.op_tela
)
UPDATE vanessa.op_tela t SET fila = n.rn
FROM numbered n WHERE t.id = n.id;

ALTER TABLE vanessa.op_tela
  DROP CONSTRAINT IF EXISTS op_tela_orden_slot_color_uq;
ALTER TABLE vanessa.op_tela
  DROP CONSTRAINT IF EXISTS op_tela_orden_id_slot_key;

-- 2. op_tela_lote: columna fila + backfill cruzando con op_tela por color
ALTER TABLE vanessa.op_tela_lote
  ADD COLUMN IF NOT EXISTS fila SMALLINT NOT NULL DEFAULT 0;

UPDATE vanessa.op_tela_lote tl SET fila = t.fila
FROM vanessa.op_tela t
WHERE t.orden_id = tl.orden_id
  AND t.slot = tl.slot
  AND t.color = tl.color;

ALTER TABLE vanessa.op_tela_lote
  DROP CONSTRAINT IF EXISTS op_tela_lote_orden_id_slot_color_lote_nombre_key;
