-- ============================================================
-- Script 29: recibo de pago adjunto en los abonos
-- Cada abono (pago realizado) puede llevar adjunto su recibo
-- (imagen o PDF) almacenado en el bucket "documentos".
-- ============================================================

ALTER TABLE vanessa.pago_abono
  ADD COLUMN IF NOT EXISTS url_recibo TEXT;
