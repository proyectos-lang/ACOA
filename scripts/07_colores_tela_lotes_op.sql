-- ============================================================
-- Script 07: Catálogo de colores, capas por color en op_tela,
--            v_seguimiento_lotes actualizado
-- ============================================================

-- 1. Tabla catálogo de colores
CREATE TABLE IF NOT EXISTS vanessa.color (
  id         SERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL UNIQUE,
  activo     BOOLEAN NOT NULL DEFAULT true,
  creado_por INTEGER REFERENCES vanessa.usuario(id),
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed inicial
INSERT INTO vanessa.color (nombre) VALUES
  ('Blanco'),('Negro'),('Rojo'),('Azul'),('Verde'),
  ('Amarillo'),('Naranja'),('Rosado'),('Gris'),('Morado'),
  ('Café'),('Beige'),('Turquesa'),('Coral'),('Fucsia'),
  ('Azul marino'),('Azul cielo'),('Verde militar'),('Verde limón'),
  ('Rojo vino'),('Salmon'),('Lila'),('Ivory'),('Camel'),('Caqui')
ON CONFLICT (nombre) DO NOTHING;

-- 2. Agregar columna capas a op_tela
ALTER TABLE vanessa.op_tela
  ADD COLUMN IF NOT EXISTS capas INTEGER NOT NULL DEFAULT 1;

-- 3. Limpiar filas con color null o vacío antes de cambiar unicidad
DELETE FROM vanessa.op_tela WHERE color IS NULL OR trim(color) = '';

-- 4. Cambiar unicidad: antes era (orden_id, slot), ahora (orden_id, slot, color)
ALTER TABLE vanessa.op_tela
  DROP CONSTRAINT IF EXISTS op_tela_orden_id_slot_key;

ALTER TABLE vanessa.op_tela
  ADD CONSTRAINT op_tela_orden_slot_color_uq UNIQUE (orden_id, slot, color);

-- 5. Actualizar v_seguimiento_lotes para incluir total_capas
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
  COALESCE(tc.total_capas, op.capas)  AS total_capas,
  e.nombre_estampador,
  e.fecha_retorno_lote  AS fecha_retorno_estampacion,
  cf.nombre_confeccionista,
  cf.fecha_retorno_lote AS fecha_retorno_confeccion,
  co.total_contado,
  co.validado           AS conteo_validado,
  COALESCE(emp.total_empacado, 0) AS total_empacado
FROM vanessa.lote l
JOIN  vanessa.orden_produccion op ON op.id     = l.orden_id
LEFT JOIN (
  SELECT orden_id, SUM(capas) AS total_capas
  FROM vanessa.op_tela
  GROUP BY orden_id
) tc ON tc.orden_id = op.id
LEFT JOIN vanessa.estampacion  e  ON e.lote_id  = l.id
LEFT JOIN vanessa.confeccion   cf ON cf.lote_id = l.id
LEFT JOIN vanessa.conteo       co ON co.lote_id = l.id
LEFT JOIN (
  SELECT lote_id, SUM(cantidad) AS total_empacado
  FROM vanessa.empaque_registro GROUP BY lote_id
) emp ON emp.lote_id = l.id
ORDER BY op.numero_op DESC, l.numero_lote;
