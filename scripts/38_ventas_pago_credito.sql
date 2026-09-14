-- ============================================================
-- Script 38: forma de pago, cartera e historial de ventas
--
-- Una venta puede ser de contado (pago inmediato) o a credito. Las de
-- credito quedan en cartera con su saldo pendiente hasta que se abonan.
--
-- Requiere el script 37.
-- ============================================================

-- Forma de pago y estado de la cartera
ALTER TABLE vanessa.venta
  ADD COLUMN IF NOT EXISTS forma_pago TEXT NOT NULL DEFAULT 'contado'
    CHECK (forma_pago IN ('contado', 'credito')),
  -- Dias de plazo para las ventas a credito
  ADD COLUMN IF NOT EXISTS dias_credito INTEGER NOT NULL DEFAULT 0,
  -- Se calcula al confirmar: fecha + dias_credito
  ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE,
  -- Suma de los abonos recibidos; el saldo es total_valor - total_abonado
  ADD COLUMN IF NOT EXISTS total_abonado NUMERIC NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_venta_forma_pago ON vanessa.venta(forma_pago);
CREATE INDEX IF NOT EXISTS idx_venta_vencimiento ON vanessa.venta(fecha_vencimiento);

-- Abonos a las ventas a credito
CREATE TABLE IF NOT EXISTS vanessa.venta_abono (
  id           SERIAL PRIMARY KEY,
  venta_id     INTEGER NOT NULL REFERENCES vanessa.venta(id) ON DELETE CASCADE,
  fecha        DATE NOT NULL,
  valor        NUMERIC NOT NULL CHECK (valor > 0),
  medio_pago   TEXT,
  referencia   TEXT,
  observacion  TEXT,
  creado_por   INTEGER REFERENCES vanessa.usuario(id),
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venta_abono_venta ON vanessa.venta_abono(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_abono_fecha ON vanessa.venta_abono(fecha);

-- Historial de la venta: que paso, cuando y quien lo hizo.
-- Se registra a nivel factura (creada, confirmada, anulada, abonada) y a
-- nivel detalle (las lineas que cambiaron), para poder auditar la venta.
CREATE TABLE IF NOT EXISTS vanessa.venta_historial (
  id            SERIAL PRIMARY KEY,
  venta_id      INTEGER NOT NULL REFERENCES vanessa.venta(id) ON DELETE CASCADE,
  -- factura: cambio de estado del documento; detalle: cambio en las lineas
  nivel         TEXT NOT NULL DEFAULT 'factura'
                  CHECK (nivel IN ('factura', 'detalle')),
  accion        TEXT NOT NULL,
  descripcion   TEXT,
  -- Instantanea de los valores relevantes al momento del evento
  total_valor   NUMERIC,
  total_unidades INTEGER,
  -- Para los eventos de detalle
  referencia    TEXT,
  talla         TEXT,
  cantidad      INTEGER,
  valor_unidad  NUMERIC,
  usuario_id    INTEGER REFERENCES vanessa.usuario(id),
  usuario_nombre TEXT,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venta_historial_venta ON vanessa.venta_historial(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_historial_nivel ON vanessa.venta_historial(nivel);
CREATE INDEX IF NOT EXISTS idx_venta_historial_fecha ON vanessa.venta_historial(creado_en);

-- Consecutivo del numero de documento de las ventas.
-- Se usa una secuencia para que el numero sea automatico y no se repita
-- aunque dos usuarios registren ventas al mismo tiempo.
CREATE SEQUENCE IF NOT EXISTS vanessa.venta_documento_seq START WITH 1;

-- Si ya hay ventas registradas, la secuencia arranca despues del mayor
-- numero existente para no chocar con los documentos ya creados
DO $$
DECLARE
  maximo BIGINT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero_documento, '\D', '', 'g'), '')::BIGINT), 0)
    INTO maximo
    FROM vanessa.venta;
  IF maximo > 0 THEN
    PERFORM setval('vanessa.venta_documento_seq', maximo, TRUE);
  END IF;
END $$;

-- Entrega el siguiente numero de documento. Es atomico: dos usuarios
-- registrando al mismo tiempo nunca obtienen el mismo numero.
CREATE OR REPLACE FUNCTION vanessa.siguiente_documento_venta()
RETURNS TEXT
LANGUAGE SQL
VOLATILE
AS $$
  SELECT nextval('vanessa.venta_documento_seq')::TEXT;
$$;

-- PostgREST expone la funcion para poder llamarla con rpc()
GRANT EXECUTE ON FUNCTION vanessa.siguiente_documento_venta() TO anon, authenticated, service_role;
