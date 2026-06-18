-- =============================================================
-- Block 4: Diseño, Corte (con lotes y promedio consumo), Estampación
-- Ejecutar en Supabase SQL Editor
-- =============================================================

-- Secuencia global para ficha de corte
CREATE SEQUENCE IF NOT EXISTS vanessa.consecutivo_corte_seq START WITH 1 INCREMENT BY 1;

-- Secuencia global para lotes
CREATE SEQUENCE IF NOT EXISTS vanessa.numero_lote_seq START WITH 1 INCREMENT BY 1;

-- ---------------------------------------------------------------
-- vanessa.diseno
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.diseno (
  id                            SERIAL PRIMARY KEY,
  orden_id                      INTEGER NOT NULL UNIQUE
                                  REFERENCES vanessa.orden_produccion(id) ON DELETE CASCADE,
  especificaciones_confirmacion TEXT,
  url_imagen_prenda             TEXT,
  carta_color                   TEXT,
  especificaciones_diseno        TEXT,
  aprobado                      BOOLEAN NOT NULL DEFAULT false,
  fecha_aprobacion              TIMESTAMPTZ,
  creado_por                    INTEGER REFERENCES vanessa.usuario(id),
  creado_en                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tr_diseno_updated_at
  BEFORE UPDATE ON vanessa.diseno
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

-- ---------------------------------------------------------------
-- vanessa.corte
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.corte (
  id                  SERIAL PRIMARY KEY,
  orden_id            INTEGER NOT NULL UNIQUE
                        REFERENCES vanessa.orden_produccion(id) ON DELETE CASCADE,
  consecutivo_corte   INTEGER NOT NULL DEFAULT nextval('vanessa.consecutivo_corte_seq'),
  fecha_programacion  DATE,
  fecha_corte         DATE,
  descripcion_piezas  TEXT,
  tipo_tela           TEXT,
  ancho_tela          NUMERIC(8, 2),
  rendimiento         NUMERIC(8, 4),
  largo_trazo         NUMERIC(10, 4),
  numero_tallas       INTEGER,
  -- Consumo promedio por prenda: largo_trazo / numero_tallas
  promedio_consumo    NUMERIC(10, 4) GENERATED ALWAYS AS (
                        ROUND(largo_trazo / NULLIF(numero_tallas::numeric, 0), 4)
                      ) STORED,
  creado_por          INTEGER REFERENCES vanessa.usuario(id),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tr_corte_updated_at
  BEFORE UPDATE ON vanessa.corte
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

-- ---------------------------------------------------------------
-- vanessa.lote
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.lote (
  id                    SERIAL PRIMARY KEY,
  corte_id              INTEGER NOT NULL
                          REFERENCES vanessa.corte(id) ON DELETE CASCADE,
  orden_id              INTEGER NOT NULL
                          REFERENCES vanessa.orden_produccion(id),
  numero_lote           INTEGER NOT NULL DEFAULT nextval('vanessa.numero_lote_seq'),
  color                 TEXT NOT NULL,
  cantidad_programada   INTEGER NOT NULL DEFAULT 0,
  precio_empaque_unidad NUMERIC(14, 2) NOT NULL DEFAULT 0,
  estado                TEXT NOT NULL DEFAULT 'cortado'
                          CHECK (estado IN ('cortado','estampacion','confeccion','conteo','empaque','completado')),
  creado_por            INTEGER REFERENCES vanessa.usuario(id),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tr_lote_updated_at
  BEFORE UPDATE ON vanessa.lote
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_lote_estado    ON vanessa.lote(estado);
CREATE INDEX IF NOT EXISTS idx_lote_orden_id  ON vanessa.lote(orden_id);
CREATE INDEX IF NOT EXISTS idx_lote_corte_id  ON vanessa.lote(corte_id);

-- ---------------------------------------------------------------
-- vanessa.estampacion
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.estampacion (
  id                      SERIAL PRIMARY KEY,
  lote_id                 INTEGER NOT NULL UNIQUE
                            REFERENCES vanessa.lote(id) ON DELETE CASCADE,
  nombre_estampador       TEXT,
  precio_estampacion      NUMERIC(14, 2),
  fecha_entrega_lote      DATE,
  fecha_retorno_lote      DATE,
  observaciones_estampado TEXT,
  creado_por              INTEGER REFERENCES vanessa.usuario(id),
  creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tr_estampacion_updated_at
  BEFORE UPDATE ON vanessa.estampacion
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

-- ---------------------------------------------------------------
-- vanessa.novedad_proceso
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.novedad_proceso (
  id          SERIAL PRIMARY KEY,
  lote_id     INTEGER NOT NULL REFERENCES vanessa.lote(id) ON DELETE CASCADE,
  proceso     TEXT NOT NULL CHECK (proceso IN ('estampacion', 'confeccion')),
  tipo        TEXT NOT NULL CHECK (tipo IN ('reposicion', 'averia', 'dano', 'cobro', 'compra')),
  cantidad    INTEGER NOT NULL DEFAULT 0,
  valor       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  descripcion TEXT,
  creado_por  INTEGER REFERENCES vanessa.usuario(id),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_novedad_proceso_lote_id ON vanessa.novedad_proceso(lote_id);

-- ---------------------------------------------------------------
-- NOTA: Crear en Supabase Storage los buckets:
--   'disenos' (imágenes de prenda confirmada, public)
-- El bucket 'moldes' ya debe existir del bloque anterior.
-- ---------------------------------------------------------------
