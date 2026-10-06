-- ============================================================
-- Script 46: piezas del conjunto en la OP y cantidad real por proceso
--
-- 1. orden_pieza: las piezas de un conjunto (Superior, Inferior, o las
--    que sean) se definen UNA vez en la ficha de la OP y todos sus lotes
--    las heredan. Antes cada lote escribia sus piezas a mano al entrar a
--    estampacion: la base acumulo 11 variantes de nombre para lo mismo
--    ("Superior", "CAMISETA", "Conjunto completo", "conjunto completp",
--    "CAMISETA Y PANTALONETA"...) y hasta la misma pieza repetida en un
--    lote.
-- 2. Cantidad real recibida de estampacion y de confeccion, por lote y
--    por pieza. Esos dos procesos solo registraban fechas: un lote podia
--    volver con 20 prendas menos y nada lo capturaba hasta conteo.
-- 3. conteo_detalle y empaque_registro llevan la pieza: en un conjunto
--    la camiseta y la pantaloneta se cuentan, empacan y pagan aparte.
-- 4. Saneamiento: 34 piezas iban atrasadas respecto a su lote porque
--    avanzar la pieza y avanzar el lote eran botones independientes.
-- ============================================================

-- ── 1. Piezas definidas en la OP ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS vanessa.orden_pieza (
  id          SERIAL PRIMARY KEY,
  orden_id    INTEGER NOT NULL REFERENCES vanessa.orden_produccion(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  posicion    INTEGER NOT NULL DEFAULT 0,
  creado_por  INTEGER REFERENCES vanessa.usuario(id),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (orden_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_orden_pieza_orden ON vanessa.orden_pieza(orden_id);

-- La pieza del lote apunta a la pieza de la OP. Queda nullable por las
-- piezas antiguas que no se logren enlazar.
ALTER TABLE vanessa.lote_prenda
  ADD COLUMN IF NOT EXISTS orden_pieza_id INTEGER REFERENCES vanessa.orden_pieza(id) ON DELETE SET NULL;

-- ── 2. Cantidad real recibida de cada proceso ──────────────────────────
ALTER TABLE vanessa.lote_prenda
  ADD COLUMN IF NOT EXISTS est_cantidad_recibida  INTEGER,
  ADD COLUMN IF NOT EXISTS conf_cantidad_recibida INTEGER;

-- Por lote (OPs de una sola prenda). confeccion.cantidad_reconfirmada ya
-- existia y cumple ese papel para confeccion.
ALTER TABLE vanessa.estampacion
  ADD COLUMN IF NOT EXISTS cantidad_recibida INTEGER;

-- ── 3. Conteo y empaque por pieza ──────────────────────────────────────
ALTER TABLE vanessa.conteo_detalle
  ADD COLUMN IF NOT EXISTS prenda_id INTEGER REFERENCES vanessa.lote_prenda(id) ON DELETE CASCADE;

-- La unicidad era (conteo, color, talla); ahora incluye la pieza. Las OPs
-- de una sola prenda siguen con prenda_id NULL, que se trata como 0.
ALTER TABLE vanessa.conteo_detalle
  DROP CONSTRAINT IF EXISTS conteo_detalle_conteo_id_color_talla_key;
CREATE UNIQUE INDEX IF NOT EXISTS ux_conteo_detalle_pieza_color_talla
  ON vanessa.conteo_detalle (conteo_id, COALESCE(prenda_id, 0), color, talla);
CREATE INDEX IF NOT EXISTS idx_conteo_detalle_prenda ON vanessa.conteo_detalle(prenda_id);

ALTER TABLE vanessa.empaque_registro
  ADD COLUMN IF NOT EXISTS prenda_id INTEGER REFERENCES vanessa.lote_prenda(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_empaque_registro_prenda ON vanessa.empaque_registro(prenda_id);

-- ── 4. Saneamiento de lo que ya existe ─────────────────────────────────

-- Nombre normalizado de una pieza: espacios simples, Capitalizado, y
-- cualquier variante de "conjunto completo" unificada
CREATE OR REPLACE FUNCTION vanessa.normalizar_pieza(n TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN lower(trim(n)) LIKE 'conjunto complet%' THEN 'Conjunto completo'
    ELSE initcap(lower(trim(regexp_replace(n, '\s+', ' ', 'g'))))
  END
$$;

-- 4a. Piezas de cada OP a partir de lo que ya tenian sus lotes
INSERT INTO vanessa.orden_pieza (orden_id, nombre, posicion)
SELECT l.orden_id, vanessa.normalizar_pieza(lp.nombre), MIN(lp.id)
  FROM vanessa.lote_prenda lp
  JOIN vanessa.lote l ON l.id = lp.lote_id
 GROUP BY l.orden_id, vanessa.normalizar_pieza(lp.nombre)
ON CONFLICT (orden_id, nombre) DO NOTHING;

-- 4b. OPs conjunto que aun no tienen ninguna pieza: Superior / Inferior
INSERT INTO vanessa.orden_pieza (orden_id, nombre, posicion)
SELECT o.id, v.nombre, v.pos
  FROM vanessa.orden_produccion o
 CROSS JOIN (VALUES ('Superior', 1), ('Inferior', 2)) AS v(nombre, pos)
 WHERE o.tipo_prenda = 'conjunto'
   AND NOT EXISTS (SELECT 1 FROM vanessa.orden_pieza p WHERE p.orden_id = o.id)
ON CONFLICT DO NOTHING;

-- Posicion 1..n por OP
WITH r AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY orden_id ORDER BY posicion, id) AS pos
    FROM vanessa.orden_pieza
)
UPDATE vanessa.orden_pieza p SET posicion = r.pos FROM r WHERE r.id = p.id;

-- 4c. Enlazar cada pieza de lote con su pieza de OP y dejarle el nombre limpio
UPDATE vanessa.lote_prenda lp
   SET orden_pieza_id = p.id,
       nombre         = p.nombre
  FROM vanessa.lote l, vanessa.orden_pieza p
 WHERE l.id = lp.lote_id
   AND p.orden_id = l.orden_id
   AND p.nombre = vanessa.normalizar_pieza(lp.nombre)
   AND lp.orden_pieza_id IS NULL;

-- 4d. La misma pieza dos veces en un lote: se queda la mas avanzada.
--     Caso real: lote 306 tenia PANTALONETA en conteo y otra ya completada.
DELETE FROM vanessa.lote_prenda lp
 USING (
   SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY lote_id, orden_pieza_id
            ORDER BY (CASE estado WHEN 'completado' THEN 4 WHEN 'conteo' THEN 3
                                  WHEN 'confeccion' THEN 2 ELSE 1 END) DESC, id
          ) AS rn
     FROM vanessa.lote_prenda
    WHERE orden_pieza_id IS NOT NULL
 ) d
 WHERE d.id = lp.id AND d.rn > 1;

-- Y que no vuelva a pasar
CREATE UNIQUE INDEX IF NOT EXISTS ux_lote_prenda_pieza
  ON vanessa.lote_prenda (lote_id, orden_pieza_id)
  WHERE orden_pieza_id IS NOT NULL;

-- 4e. Piezas atrasadas respecto a su lote. El lote fisico ya avanzo (los
--     procesos lo ven en su bandeja), asi que la pieza se pone al dia.
--     Solo se mueven hacia adelante: una pieza adelantada es legitima
--     (termino confeccion antes que su pareja).
UPDATE vanessa.lote_prenda lp
   SET estado = CASE l.estado
                  WHEN 'confeccion' THEN 'confeccion'
                  WHEN 'conteo'     THEN 'conteo'
                  ELSE 'completado'
                END
  FROM vanessa.lote l
 WHERE l.id = lp.lote_id
   AND l.estado IN ('confeccion', 'conteo', 'empaque', 'finalizado')
   AND (CASE lp.estado WHEN 'estampacion' THEN 1 WHEN 'confeccion' THEN 2
                       WHEN 'conteo' THEN 3 ELSE 4 END)
     < (CASE l.estado WHEN 'confeccion' THEN 2 WHEN 'conteo' THEN 3 ELSE 4 END);

GRANT SELECT, INSERT, UPDATE, DELETE ON vanessa.orden_pieza TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE vanessa.orden_pieza_id_seq TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
