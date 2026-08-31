-- ============================================================
-- Script 26: módulo de Pagos (estampadores y confeccionistas)
-- - pago_produccion: un pago habilitado por lote (o por prenda en
--   OPs tipo conjunto) y proceso. total = cantidad × precio unitario.
--   El de estampación se habilita manualmente desde la ficha;
--   el de confección se habilita automáticamente al validar el conteo
--   con las cantidades contadas efectivas.
-- - pago_abono: abonos (pagos parciales) sobre cada pago habilitado.
-- ============================================================

CREATE TABLE IF NOT EXISTS vanessa.pago_produccion (
  id              SERIAL PRIMARY KEY,
  lote_id         INTEGER NOT NULL REFERENCES vanessa.lote(id) ON DELETE CASCADE,
  prenda_id       INTEGER REFERENCES vanessa.lote_prenda(id) ON DELETE CASCADE,
  proceso         TEXT NOT NULL CHECK (proceso IN ('estampacion', 'confeccion')),
  beneficiario    TEXT NOT NULL,
  cantidad        INTEGER NOT NULL DEFAULT 0,
  precio_unitario NUMERIC NOT NULL DEFAULT 0,
  total           NUMERIC NOT NULL DEFAULT 0,
  pagado          NUMERIC NOT NULL DEFAULT 0,
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'parcial', 'pagado')),
  habilitado_por  INTEGER REFERENCES vanessa.usuario(id),
  habilitado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un solo pago por lote+proceso (por prenda en conjuntos)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pago_lote_proceso_prenda
  ON vanessa.pago_produccion (lote_id, proceso, COALESCE(prenda_id, 0));

CREATE INDEX IF NOT EXISTS idx_pago_produccion_lote ON vanessa.pago_produccion(lote_id);

CREATE TABLE IF NOT EXISTS vanessa.pago_abono (
  id          SERIAL PRIMARY KEY,
  pago_id     INTEGER NOT NULL REFERENCES vanessa.pago_produccion(id) ON DELETE CASCADE,
  valor       NUMERIC NOT NULL,
  fecha       DATE NOT NULL,
  observacion TEXT,
  creado_por  INTEGER REFERENCES vanessa.usuario(id),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pago_abono_pago ON vanessa.pago_abono(pago_id);
