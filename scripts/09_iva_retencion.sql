-- ─── IVA y retención en hoja de costos ──────────────────────────────────────
-- Porcentajes configurables por OP para calcular el neto por prenda:
--   neto = precio_venta + (precio_venta × porc_iva%) − (precio_venta × porc_retencion%)

ALTER TABLE vanessa.hoja_costos
  ADD COLUMN IF NOT EXISTS porc_iva       NUMERIC(5,2) NOT NULL DEFAULT 19,
  ADD COLUMN IF NOT EXISTS porc_retencion NUMERIC(5,2) NOT NULL DEFAULT 2.5;
