-- ============================================================
-- Script 39: razon social que factura
--
-- Cada venta se factura a nombre de una de las dos razones sociales
-- de la empresa: ACOA o GOODFATHER.
--
-- Requiere los scripts 37 y 38.
-- ============================================================

ALTER TABLE vanessa.venta
  ADD COLUMN IF NOT EXISTS razon_social TEXT NOT NULL DEFAULT 'ACOA'
    CHECK (razon_social IN ('ACOA', 'GOODFATHER'));

CREATE INDEX IF NOT EXISTS idx_venta_razon_social ON vanessa.venta(razon_social);

-- El historial guarda con que razon social se emitio cada evento, para
-- poder filtrarlo despues sin depender de la venta
ALTER TABLE vanessa.venta_historial
  ADD COLUMN IF NOT EXISTS razon_social TEXT;

CREATE INDEX IF NOT EXISTS idx_venta_historial_razon ON vanessa.venta_historial(razon_social);

-- Las ventas historicas ya cargadas quedan a nombre de ACOA (el valor
-- por defecto); el historial existente se completa con el de su venta
UPDATE vanessa.venta_historial h
   SET razon_social = v.razon_social
  FROM vanessa.venta v
 WHERE h.venta_id = v.id
   AND h.razon_social IS NULL;
