-- ============================================================
-- Script 30: datos bancarios de estampadores y confeccionistas
-- Numero de cuenta, banco, tipo de cuenta y certificacion bancaria
-- adjunta (bucket "documentos"), para que en Pagos se vea a quien
-- pagar y a que cuenta.
-- ============================================================

ALTER TABLE vanessa.estampador
  ADD COLUMN IF NOT EXISTS banco                  TEXT,
  ADD COLUMN IF NOT EXISTS tipo_cuenta            TEXT,
  ADD COLUMN IF NOT EXISTS numero_cuenta          TEXT,
  ADD COLUMN IF NOT EXISTS url_certificacion_bancaria TEXT;

ALTER TABLE vanessa.confeccionista
  ADD COLUMN IF NOT EXISTS banco                  TEXT,
  ADD COLUMN IF NOT EXISTS tipo_cuenta            TEXT,
  ADD COLUMN IF NOT EXISTS numero_cuenta          TEXT,
  ADD COLUMN IF NOT EXISTS url_certificacion_bancaria TEXT;
