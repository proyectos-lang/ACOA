-- =============================================================================
-- Block 6: Inventario de materiales, rediseño curva, lotes libres, seguimiento
-- Ejecutar en Supabase SQL Editor
-- =============================================================================

-- ─── 1. movimiento_inventario ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vanessa.movimiento_inventario (
  id          SERIAL PRIMARY KEY,
  material_id INTEGER NOT NULL REFERENCES vanessa.material(id) ON DELETE CASCADE,
  tipo        TEXT    NOT NULL CHECK (tipo IN ('entrada','salida')),
  concepto    TEXT    NOT NULL CHECK (concepto IN ('compra','ajuste','devolucion','op_consumo','otro')),
  cantidad    NUMERIC(14,4) NOT NULL CHECK (cantidad > 0),
  orden_id    INTEGER REFERENCES vanessa.orden_produccion(id) ON DELETE SET NULL,
  observacion TEXT,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  creado_por  INTEGER REFERENCES vanessa.usuario(id),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movimiento_material ON vanessa.movimiento_inventario(material_id);
CREATE INDEX IF NOT EXISTS idx_movimiento_orden    ON vanessa.movimiento_inventario(orden_id);
CREATE INDEX IF NOT EXISTS idx_movimiento_fecha    ON vanessa.movimiento_inventario(fecha);

-- ─── Vista: stock actual por material ────────────────────────────────────────
CREATE OR REPLACE VIEW vanessa.v_stock_material AS
SELECT
  m.id            AS material_id,
  m.nombre,
  m.tipo,
  m.unidad_medida,
  m.valor_unitario,
  m.activo,
  COALESCE(SUM(CASE WHEN mi.tipo = 'entrada' THEN mi.cantidad ELSE 0       END), 0) AS total_entradas,
  COALESCE(SUM(CASE WHEN mi.tipo = 'salida'  THEN mi.cantidad ELSE 0       END), 0) AS total_salidas,
  COALESCE(SUM(CASE WHEN mi.tipo = 'entrada' THEN mi.cantidad ELSE -mi.cantidad END), 0) AS existencias
FROM vanessa.material m
LEFT JOIN vanessa.movimiento_inventario mi ON mi.material_id = m.id
GROUP BY m.id, m.nombre, m.tipo, m.unidad_medida, m.valor_unitario, m.activo;

-- ─── 2. op_tela (hasta 3 materiales de tela por OP) ──────────────────────────
CREATE TABLE IF NOT EXISTS vanessa.op_tela (
  id             SERIAL PRIMARY KEY,
  orden_id       INTEGER  NOT NULL REFERENCES vanessa.orden_produccion(id) ON DELETE CASCADE,
  slot           SMALLINT NOT NULL CHECK (slot IN (1, 2, 3)),
  tipo_tela      TEXT,
  color          TEXT,
  creado_por     INTEGER REFERENCES vanessa.usuario(id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (orden_id, slot)
);

CREATE TRIGGER tr_op_tela_updated_at
  BEFORE UPDATE ON vanessa.op_tela
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

-- ─── 3. Rediseño curva_talla (solo talla, sin color/cantidad/capas) ───────────
-- ADVERTENCIA: elimina todos los datos existentes de curva_talla
TRUNCATE vanessa.curva_talla;

ALTER TABLE vanessa.curva_talla DROP COLUMN IF EXISTS color;
ALTER TABLE vanessa.curva_talla DROP COLUMN IF EXISTS cantidad;
ALTER TABLE vanessa.curva_talla DROP COLUMN IF EXISTS capas;

ALTER TABLE vanessa.curva_talla
  ADD CONSTRAINT curva_talla_orden_talla_uq UNIQUE (orden_id, talla);

-- ─── 4. orden_produccion: agregar campo capas ─────────────────────────────────
ALTER TABLE vanessa.orden_produccion
  ADD COLUMN IF NOT EXISTS capas INTEGER NOT NULL DEFAULT 1;

-- ─── 5. corte: numero_tallas → capas ─────────────────────────────────────────
-- Las columnas generadas deben eliminarse antes de modificar sus dependencias
ALTER TABLE vanessa.corte DROP COLUMN IF EXISTS promedio_consumo;

ALTER TABLE vanessa.corte ADD COLUMN IF NOT EXISTS capas INTEGER;
UPDATE vanessa.corte SET capas = numero_tallas WHERE capas IS NULL;
ALTER TABLE vanessa.corte DROP COLUMN IF EXISTS numero_tallas;

ALTER TABLE vanessa.corte
  ADD COLUMN promedio_consumo NUMERIC(10,4)
    GENERATED ALWAYS AS (
      ROUND(largo_trazo / NULLIF(capas::numeric, 0), 4)
    ) STORED;

-- ─── 5b. corte_tela: numero_tallas → capas ───────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'vanessa' AND table_name = 'corte_tela' AND column_name = 'numero_tallas'
  ) THEN
    -- Eliminar promedio_consumo GENERATED primero (depende de numero_tallas)
    ALTER TABLE vanessa.corte_tela DROP COLUMN IF EXISTS promedio_consumo;
    ALTER TABLE vanessa.corte_tela ADD COLUMN capas INTEGER;
    EXECUTE 'UPDATE vanessa.corte_tela SET capas = numero_tallas WHERE capas IS NULL';
    ALTER TABLE vanessa.corte_tela DROP COLUMN numero_tallas;
    ALTER TABLE vanessa.corte_tela ADD COLUMN promedio_consumo NUMERIC(10,4)
      GENERATED ALWAYS AS (ROUND(largo_trazo / NULLIF(capas::numeric, 0), 4)) STORED;
  END IF;
END $$;

-- ─── 6. lote: corte_id nullable, descripcion, color nullable ─────────────────
ALTER TABLE vanessa.lote ALTER COLUMN corte_id DROP NOT NULL;
ALTER TABLE vanessa.lote ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- color ya no identifica el lote; se hace nullable
ALTER TABLE vanessa.lote ALTER COLUMN color DROP NOT NULL;
ALTER TABLE vanessa.lote ALTER COLUMN color SET DEFAULT NULL;

-- ─── 7. hoja_costos: total_unidades y costo_total ────────────────────────────
ALTER TABLE vanessa.hoja_costos
  ADD COLUMN IF NOT EXISTS total_unidades INTEGER NOT NULL DEFAULT 0;

-- costo_total es columna generada basada en costo_unitario (mantenida por la app)
-- Solo se puede agregar si no existe ya
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'vanessa'
      AND table_name   = 'hoja_costos'
      AND column_name  = 'costo_total'
  ) THEN
    ALTER TABLE vanessa.hoja_costos
      ADD COLUMN costo_total NUMERIC(14,2)
        GENERATED ALWAYS AS (ROUND(costo_unitario * total_unidades, 2)) STORED;
  END IF;
END $$;

-- ─── 8. Vista v_seguimiento_lotes ────────────────────────────────────────────
CREATE OR REPLACE VIEW vanessa.v_seguimiento_lotes AS
SELECT
  l.id                  AS lote_id,
  l.numero_lote,
  l.descripcion         AS lote_descripcion,
  l.cantidad_programada,
  l.estado              AS estado_lote,
  l.orden_id,
  op.numero_op,
  op.referencia,
  op.descripcion        AS op_descripcion,
  op.estado             AS estado_op,
  op.capas,
  e.nombre_estampador,
  e.fecha_retorno_lote  AS fecha_retorno_estampacion,
  cf.nombre_confeccionista,
  cf.fecha_retorno_lote AS fecha_retorno_confeccion,
  co.total_contado,
  co.validado           AS conteo_validado,
  COALESCE(emp.total_empacado, 0) AS total_empacado
FROM vanessa.lote l
JOIN  vanessa.orden_produccion op ON op.id     = l.orden_id
LEFT JOIN vanessa.estampacion  e  ON e.lote_id  = l.id
LEFT JOIN vanessa.confeccion   cf ON cf.lote_id = l.id
LEFT JOIN vanessa.conteo       co ON co.lote_id = l.id
LEFT JOIN (
  SELECT lote_id, SUM(cantidad) AS total_empacado
  FROM vanessa.empaque_registro
  GROUP BY lote_id
) emp ON emp.lote_id = l.id
ORDER BY op.numero_op DESC, l.numero_lote;
