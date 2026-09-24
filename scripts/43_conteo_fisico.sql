-- ============================================================
-- Script 43: conteo fisico de inventario
--
-- Se abre un conteo sobre las referencias que se van a contar, se
-- registra lo que hay en fisico y al cerrarlo el sistema ajusta el
-- inventario con la diferencia.
--
-- Requiere el script 34 (inventrans).
-- ============================================================

CREATE TABLE IF NOT EXISTS vanessa.conteo_fisico (
  id              SERIAL PRIMARY KEY,
  numero          TEXT NOT NULL,
  fecha           DATE NOT NULL,
  -- abierto: se esta contando; cerrado: ya ajusto el inventario
  estado          TEXT NOT NULL DEFAULT 'abierto'
                    CHECK (estado IN ('abierto', 'cerrado', 'anulado')),
  -- Que se conto: todo, o una seleccion de referencias
  alcance         TEXT NOT NULL DEFAULT 'seleccion'
                    CHECK (alcance IN ('todo', 'seleccion')),
  observacion     TEXT,
  -- Resumen que queda al cerrar
  total_lineas    INTEGER NOT NULL DEFAULT 0,
  lineas_con_dif  INTEGER NOT NULL DEFAULT 0,
  unidades_sistema INTEGER NOT NULL DEFAULT 0,
  unidades_fisico  INTEGER NOT NULL DEFAULT 0,
  diferencia_total INTEGER NOT NULL DEFAULT 0,
  -- Quien lo abrio y quien lo cerro
  abierto_por     INTEGER REFERENCES vanessa.usuario(id),
  abierto_nombre  TEXT,
  abierto_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cerrado_por     INTEGER REFERENCES vanessa.usuario(id),
  cerrado_nombre  TEXT,
  cerrado_en      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_conteo_fisico_numero
  ON vanessa.conteo_fisico (upper(trim(numero)));
CREATE INDEX IF NOT EXISTS idx_conteo_fisico_fecha ON vanessa.conteo_fisico(fecha);
CREATE INDEX IF NOT EXISTS idx_conteo_fisico_estado ON vanessa.conteo_fisico(estado);

-- Detalle: el inventario se lleva por referencia + talla
CREATE TABLE IF NOT EXISTS vanessa.conteo_fisico_detalle (
  id                 SERIAL PRIMARY KEY,
  conteo_fisico_id   INTEGER NOT NULL
                       REFERENCES vanessa.conteo_fisico(id) ON DELETE CASCADE,
  referencia         TEXT NOT NULL,
  descripcion        TEXT,
  talla              TEXT NOT NULL,
  -- Lo que decia el sistema cuando se abrio el conteo
  cantidad_sistema   INTEGER NOT NULL DEFAULT 0,
  -- Lo que se conto en fisico; null mientras no se haya contado
  cantidad_fisica    INTEGER,
  observacion        TEXT,
  -- Movimiento de ajuste que genero esta linea al cerrar
  inventrans_id      INTEGER REFERENCES vanessa.inventrans(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_conteo_fisico_detalle
  ON vanessa.conteo_fisico_detalle(conteo_fisico_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_conteo_fisico_linea
  ON vanessa.conteo_fisico_detalle (conteo_fisico_id, upper(trim(referencia)), upper(trim(talla)));

-- Consecutivo del numero de conteo
CREATE SEQUENCE IF NOT EXISTS vanessa.conteo_fisico_seq START WITH 1;

CREATE OR REPLACE FUNCTION vanessa.siguiente_conteo_fisico()
RETURNS TEXT
LANGUAGE SQL
VOLATILE
AS $$
  SELECT 'CF-' || lpad(nextval('vanessa.conteo_fisico_seq')::TEXT, 5, '0');
$$;

GRANT EXECUTE ON FUNCTION vanessa.siguiente_conteo_fisico()
  TO anon, authenticated, service_role;
