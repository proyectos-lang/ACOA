-- ============================================================
-- Script 40: registrar empaque solo en inventario (sin pago)
--
-- Hay empaques que cargan el inventario pero no se le pagan a la
-- empacadora (reempaque, correccion, producto devuelto). Con esta
-- bandera el registro suma al inventario pero no entra a la nomina
-- por produccion.
-- ============================================================

ALTER TABLE vanessa.empaque_registro
  ADD COLUMN IF NOT EXISTS genera_pago BOOLEAN NOT NULL DEFAULT TRUE;

-- Los registros que ya existen se pagaron: conservan genera_pago = TRUE
CREATE INDEX IF NOT EXISTS idx_empaque_registro_genera_pago
  ON vanessa.empaque_registro(genera_pago);
