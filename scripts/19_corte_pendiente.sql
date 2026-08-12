-- ============================================================
-- Script 19: pendiente por falta de materiales en Corte
-- El cortador puede marcar la OP como pendiente indicando qué
-- materiales faltaron; queda como alerta visible en el listado
-- de Corte y en la ficha hasta que se marque como resuelto.
-- ============================================================

ALTER TABLE vanessa.corte
  ADD COLUMN IF NOT EXISTS pendiente        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pendiente_motivo TEXT,
  ADD COLUMN IF NOT EXISTS pendiente_en     TIMESTAMPTZ;
