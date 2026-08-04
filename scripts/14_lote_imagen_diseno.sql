-- ============================================================
-- Script 14: imagen de referencia y notas de diseño por lote
-- Cada lote puede tener su propia imagen (subida desde el módulo
-- de Diseño) que lo acompaña a lo largo de la cadena de producción.
-- ============================================================

ALTER TABLE vanessa.lote
  ADD COLUMN IF NOT EXISTS url_imagen  TEXT,
  ADD COLUMN IF NOT EXISTS notas_diseno TEXT;
