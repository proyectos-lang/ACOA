-- ============================================================
-- Script 31: comprobantes de pago (varios por pago)
-- Cada pago habilitado puede tener uno o mas comprobantes adjuntos
-- (imagen o PDF) almacenados en el bucket "documentos", ademas del
-- recibo que ya se adjunta por abono en pago_abono.url_recibo.
-- ============================================================

CREATE TABLE IF NOT EXISTS vanessa.pago_comprobante (
  id          SERIAL PRIMARY KEY,
  pago_id     INTEGER NOT NULL REFERENCES vanessa.pago_produccion(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  nombre      TEXT,
  descripcion TEXT,
  creado_por  INTEGER REFERENCES vanessa.usuario(id),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pago_comprobante_pago ON vanessa.pago_comprobante(pago_id);
