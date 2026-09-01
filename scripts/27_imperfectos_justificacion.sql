-- ============================================================
-- Script 27: imperfectos por talla + justificación de diferencias
-- - conteo_detalle.imperfectos: imperfectos/problemas de calidad
--   identificados al contar cada talla.
-- - conteo.justificacion_diferencia: obligatoria al validar si lo
--   registrado (contadas + imperfectos) es menor a lo programado.
-- - empaque_registro.imperfectos: imperfectos encontrados al empacar
--   cada talla.
-- - lote.justificacion_empaque: obligatoria al finalizar el lote si
--   lo empacado + imperfectos es menor a lo contado.
-- ============================================================

ALTER TABLE vanessa.conteo_detalle
  ADD COLUMN IF NOT EXISTS imperfectos INTEGER NOT NULL DEFAULT 0;

ALTER TABLE vanessa.conteo
  ADD COLUMN IF NOT EXISTS justificacion_diferencia TEXT;

ALTER TABLE vanessa.empaque_registro
  ADD COLUMN IF NOT EXISTS imperfectos INTEGER NOT NULL DEFAULT 0;

ALTER TABLE vanessa.lote
  ADD COLUMN IF NOT EXISTS justificacion_empaque TEXT;
