-- =============================================================
-- Block 5: Confección, Conteo y Empaque
-- Ejecutar en Supabase SQL Editor
-- =============================================================

-- Ampliar el CHECK de vanessa.lote para incluir 'finalizado'
DO $$
BEGIN
  ALTER TABLE vanessa.lote DROP CONSTRAINT lote_estado_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE vanessa.lote ADD CONSTRAINT lote_estado_check
  CHECK (estado IN (
    'cortado','estampacion','confeccion','conteo','empaque','completado','finalizado'
  ));

-- ---------------------------------------------------------------
-- vanessa.confeccion
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.confeccion (
  id                     SERIAL PRIMARY KEY,
  lote_id                INTEGER NOT NULL UNIQUE
                           REFERENCES vanessa.lote(id) ON DELETE CASCADE,
  cantidad_reconfirmada  INTEGER,
  nombre_confeccionista  TEXT,
  precio_confeccion      NUMERIC(14, 2),
  fecha_entrega_lote     DATE,
  fecha_retorno_lote     DATE,
  url_imagen_prenda      TEXT,
  condiciones_confeccion TEXT,
  creado_por             INTEGER REFERENCES vanessa.usuario(id),
  creado_en              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tr_confeccion_updated_at
  BEFORE UPDATE ON vanessa.confeccion
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

-- ---------------------------------------------------------------
-- vanessa.confeccion_insumo
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.confeccion_insumo (
  id            SERIAL PRIMARY KEY,
  confeccion_id INTEGER NOT NULL
                  REFERENCES vanessa.confeccion(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  valor         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  creado_por    INTEGER REFERENCES vanessa.usuario(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_confeccion_insumo_confeccion_id
  ON vanessa.confeccion_insumo(confeccion_id);

-- ---------------------------------------------------------------
-- vanessa.conteo
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.conteo (
  id             SERIAL PRIMARY KEY,
  lote_id        INTEGER NOT NULL UNIQUE
                   REFERENCES vanessa.lote(id) ON DELETE CASCADE,
  fecha_conteo   DATE,
  total_contado  INTEGER NOT NULL DEFAULT 0,
  validado       BOOLEAN NOT NULL DEFAULT false,
  observacion    TEXT,
  creado_por     INTEGER REFERENCES vanessa.usuario(id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tr_conteo_updated_at
  BEFORE UPDATE ON vanessa.conteo
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

-- ---------------------------------------------------------------
-- vanessa.conteo_detalle
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.conteo_detalle (
  id               SERIAL PRIMARY KEY,
  conteo_id        INTEGER NOT NULL
                     REFERENCES vanessa.conteo(id) ON DELETE CASCADE,
  color            TEXT NOT NULL,
  talla            TEXT NOT NULL,
  cantidad_contada INTEGER NOT NULL DEFAULT 0,
  creado_por       INTEGER REFERENCES vanessa.usuario(id),
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conteo_id, color, talla)
);

CREATE INDEX IF NOT EXISTS idx_conteo_detalle_conteo_id
  ON vanessa.conteo_detalle(conteo_id);

-- ---------------------------------------------------------------
-- vanessa.empaque_registro
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.empaque_registro (
  id           SERIAL PRIMARY KEY,
  lote_id      INTEGER NOT NULL
                 REFERENCES vanessa.lote(id) ON DELETE CASCADE,
  persona_id   INTEGER NOT NULL
                 REFERENCES vanessa.persona(id),
  color        TEXT NOT NULL,
  talla        TEXT NOT NULL,
  cantidad     INTEGER NOT NULL DEFAULT 0,
  precio_unidad NUMERIC(14, 2) NOT NULL DEFAULT 0,
  -- valor_total calculado por la BD
  valor_total  NUMERIC(14, 2) GENERATED ALWAYS AS (
                 ROUND(cantidad::numeric * precio_unidad, 2)
               ) STORED,
  fecha        DATE NOT NULL,
  creado_por   INTEGER REFERENCES vanessa.usuario(id),
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_empaque_registro_lote_id
  ON vanessa.empaque_registro(lote_id);
CREATE INDEX IF NOT EXISTS idx_empaque_registro_persona_id
  ON vanessa.empaque_registro(persona_id);
CREATE INDEX IF NOT EXISTS idx_empaque_registro_fecha
  ON vanessa.empaque_registro(fecha);

-- ---------------------------------------------------------------
-- NOTA: Crear en Supabase Storage el bucket:
--   'confeccion' (imágenes de prenda en confección, public)
-- ---------------------------------------------------------------
