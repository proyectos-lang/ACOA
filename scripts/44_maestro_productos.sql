-- ============================================================
-- Script 44: maestro de productos y doble contabilidad
--
-- Cada referencia pertenece a una empresa (ACOA o GOODFATHER). Al
-- registrar una venta, el producto define a que empresa va esa linea,
-- de modo que se puede ver el total global y aparte solo lo de ACOA.
--
-- Requiere el script 37 (referencia_venta, venta_detalle).
-- ============================================================

-- La empresa a la que pertenece cada referencia
ALTER TABLE vanessa.referencia_venta
  ADD COLUMN IF NOT EXISTS empresa TEXT NOT NULL DEFAULT 'ACOA'
    CHECK (empresa IN ('ACOA', 'GOODFATHER'));

CREATE INDEX IF NOT EXISTS idx_referencia_venta_empresa
  ON vanessa.referencia_venta(empresa);

-- Cada linea de la venta guarda la empresa del producto. Se copia al
-- registrar: si mañana el producto cambia de empresa, las ventas ya
-- hechas conservan como se contabilizaron.
ALTER TABLE vanessa.venta_detalle
  ADD COLUMN IF NOT EXISTS empresa TEXT NOT NULL DEFAULT 'ACOA'
    CHECK (empresa IN ('ACOA', 'GOODFATHER'));

CREATE INDEX IF NOT EXISTS idx_venta_detalle_empresa
  ON vanessa.venta_detalle(empresa);

-- Las lineas ya existentes toman la empresa de su referencia
UPDATE vanessa.venta_detalle d
   SET empresa = r.empresa
  FROM vanessa.referencia_venta r
 WHERE upper(trim(d.referencia)) = upper(trim(r.referencia));
