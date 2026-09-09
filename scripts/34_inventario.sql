-- ============================================================
-- Script 34: inventario de producto terminado (inventrans)
-- Cada empaque registrado genera una ENTRADA de inventario con la
-- trazabilidad completa (OP, referencia, lote, prenda, talla).
-- Las salidas se registran manualmente. El inventario disponible es
-- la suma de entradas menos las salidas.
-- ============================================================

CREATE TABLE IF NOT EXISTS vanessa.inventrans (
  id             SERIAL PRIMARY KEY,
  tipo           TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
  motivo         TEXT NOT NULL DEFAULT 'empaque',
  -- Trazabilidad de la prenda
  orden_id       INTEGER REFERENCES vanessa.orden_produccion(id) ON DELETE SET NULL,
  numero_op      INTEGER,
  referencia     TEXT,
  lote_id        INTEGER REFERENCES vanessa.lote(id) ON DELETE SET NULL,
  lote_nombre    TEXT,
  prenda_id      INTEGER REFERENCES vanessa.lote_prenda(id) ON DELETE SET NULL,
  prenda_nombre  TEXT,
  talla          TEXT NOT NULL,
  color          TEXT,
  -- Movimiento: positivo siempre; el tipo define si suma o resta
  cantidad       INTEGER NOT NULL,
  fecha          DATE NOT NULL,
  observacion    TEXT,
  -- Origen: el registro de empaque que lo genero (evita duplicados)
  empaque_registro_id INTEGER REFERENCES vanessa.empaque_registro(id) ON DELETE CASCADE,
  creado_por     INTEGER REFERENCES vanessa.usuario(id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un registro de empaque genera una sola entrada de inventario
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventrans_empaque
  ON vanessa.inventrans (empaque_registro_id)
  WHERE empaque_registro_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventrans_lote ON vanessa.inventrans(lote_id);
CREATE INDEX IF NOT EXISTS idx_inventrans_orden ON vanessa.inventrans(orden_id);
CREATE INDEX IF NOT EXISTS idx_inventrans_fecha ON vanessa.inventrans(fecha);

-- Vista de saldos: entradas menos salidas por referencia, lote, prenda y talla
CREATE OR REPLACE VIEW vanessa.v_inventario AS
SELECT
  orden_id,
  numero_op,
  referencia,
  lote_id,
  lote_nombre,
  prenda_nombre,
  talla,
  SUM(CASE WHEN tipo = 'entrada' THEN cantidad
           WHEN tipo = 'salida'  THEN -cantidad
           ELSE cantidad END) AS disponible,
  SUM(CASE WHEN tipo = 'entrada' THEN cantidad ELSE 0 END) AS total_entradas,
  SUM(CASE WHEN tipo = 'salida'  THEN cantidad ELSE 0 END) AS total_salidas,
  MAX(fecha) AS ultimo_movimiento
FROM vanessa.inventrans
GROUP BY orden_id, numero_op, referencia, lote_id, lote_nombre, prenda_nombre, talla;
