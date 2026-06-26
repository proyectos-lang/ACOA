-- ============================================================
-- Script 08: Tabla op_tela_lote (capas por color × lote)
--            y v_seguimiento_lotes actualizado
-- NOTA: ejecutar DESPUÉS del script 07
-- ============================================================

-- 1. Nueva tabla: capas por (color, lote) dentro de cada slot
CREATE TABLE IF NOT EXISTS vanessa.op_tela_lote (
  id          SERIAL PRIMARY KEY,
  orden_id    INTEGER  NOT NULL REFERENCES vanessa.orden_produccion(id) ON DELETE CASCADE,
  slot        SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 3),
  color       TEXT     NOT NULL,
  lote_nombre TEXT     NOT NULL,
  capas       INTEGER  NOT NULL DEFAULT 1 CHECK (capas >= 1),
  creado_por  INTEGER  REFERENCES vanessa.usuario(id),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(orden_id, slot, color, lote_nombre)
);

-- 2. Recrea v_seguimiento_lotes usando op_tela_lote para total_capas
--    DROP primero porque PostgreSQL no permite renombrar columnas con CREATE OR REPLACE
DROP VIEW IF EXISTS vanessa.v_seguimiento_lotes;

CREATE VIEW vanessa.v_seguimiento_lotes AS
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
JOIN  vanessa.orden_produccion op ON op.id = l.orden_id
LEFT JOIN (
  SELECT orden_id, SUM(capas) AS total_capas
  FROM vanessa.op_tela_lote
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
