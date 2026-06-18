-- =============================================================================
-- Block 3: Orden de Producción, Materiales, Curva de Tallas, Hoja de Costos
-- Esquema: vanessa | Sin RLS | Service role key en servidor
-- =============================================================================

-- Secuencia para numero_op (legible, comienza en 1001)
CREATE SEQUENCE IF NOT EXISTS vanessa.numero_op_seq
  START WITH 1001
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- ─── Material (maestro) ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vanessa.material (
  id               SERIAL PRIMARY KEY,
  tipo             TEXT NOT NULL,
  nombre           TEXT NOT NULL,
  unidad_medida    TEXT NOT NULL,
  valor_unitario   NUMERIC(14,4) NOT NULL DEFAULT 0,
  activo           BOOLEAN NOT NULL DEFAULT true,
  creado_por       INTEGER REFERENCES vanessa.usuario(id),
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tr_material_updated_at
  BEFORE UPDATE ON vanessa.material
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

-- ─── Orden de Producción ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vanessa.orden_produccion (
  id                   SERIAL PRIMARY KEY,
  numero_op            INTEGER NOT NULL DEFAULT nextval('vanessa.numero_op_seq'),
  fecha_programacion   DATE,
  referencia           TEXT NOT NULL,
  descripcion          TEXT,
  url_molde            TEXT,
  gama_color           TEXT,
  observaciones        TEXT,
  estado               TEXT NOT NULL DEFAULT 'programada'
                         CHECK (estado IN (
                           'programada','diseno','corte','estampacion',
                           'confeccion','conteo','empaque','terminada'
                         )),
  creado_por           INTEGER REFERENCES vanessa.usuario(id),
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tr_orden_produccion_updated_at
  BEFORE UPDATE ON vanessa.orden_produccion
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_orden_produccion_estado
  ON vanessa.orden_produccion(estado);

-- ─── Materiales por OP ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vanessa.op_material (
  id                SERIAL PRIMARY KEY,
  orden_id          INTEGER NOT NULL REFERENCES vanessa.orden_produccion(id) ON DELETE CASCADE,
  material_id       INTEGER REFERENCES vanessa.material(id),
  tipo              TEXT NOT NULL,
  nombre            TEXT NOT NULL,
  unidad_medida     TEXT NOT NULL,
  valor_unitario    NUMERIC(14,4) NOT NULL DEFAULT 0,
  consumo_estimado  NUMERIC(14,4),
  consumo_real      NUMERIC(14,4),
  valor_por_prenda  NUMERIC(14,4) GENERATED ALWAYS AS (
                      ROUND(valor_unitario * COALESCE(consumo_real, consumo_estimado, 0), 4)
                    ) STORED,
  creado_por        INTEGER REFERENCES vanessa.usuario(id),
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tr_op_material_updated_at
  BEFORE UPDATE ON vanessa.op_material
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_op_material_orden_id
  ON vanessa.op_material(orden_id);

-- ─── Curva de tallas ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vanessa.curva_talla (
  id         SERIAL PRIMARY KEY,
  orden_id   INTEGER NOT NULL REFERENCES vanessa.orden_produccion(id) ON DELETE CASCADE,
  color      TEXT NOT NULL,
  talla      TEXT NOT NULL,
  cantidad   INTEGER NOT NULL DEFAULT 0,
  capas      INTEGER NOT NULL DEFAULT 1,
  creado_por INTEGER REFERENCES vanessa.usuario(id),
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curva_talla_orden_id
  ON vanessa.curva_talla(orden_id);

-- ─── Hoja de costos (confidencial) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vanessa.hoja_costos (
  id                           SERIAL PRIMARY KEY,
  orden_id                     INTEGER NOT NULL UNIQUE
                                 REFERENCES vanessa.orden_produccion(id) ON DELETE CASCADE,

  -- 15 valores fijos (los digita el usuario)
  valor_cordon                 NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_empaque                NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_bandera                NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_corte                  NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_trazos_insumos_corte   NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_estampacion_aplique_dtf NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_confeccion             NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_bolsas_flechas_stickers NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_etiqueta               NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_instruccion            NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_comision               NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_transporte             NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_flete                  NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_viaticos               NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_oros                   NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Mantenidos por la app
  costo_materiales             NUMERIC(14,4) NOT NULL DEFAULT 0,
  costo_unitario               NUMERIC(14,4) NOT NULL DEFAULT 0,

  -- Usuario digita
  precio_venta                 NUMERIC(14,2),

  -- Calculado por la BD (solo lectura desde la app)
  margen                       NUMERIC(10,4) GENERATED ALWAYS AS (
                                 CASE
                                   WHEN COALESCE(precio_venta, 0) > 0
                                   THEN ROUND(
                                     (precio_venta - COALESCE(costo_unitario, 0))
                                     / precio_venta * 100, 2
                                   )
                                   ELSE 0
                                 END
                               ) STORED,

  creado_por                   INTEGER REFERENCES vanessa.usuario(id),
  creado_en                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tr_hoja_costos_updated_at
  BEFORE UPDATE ON vanessa.hoja_costos
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

-- ─── Trigger: auto-crear hoja_costos al insertar OP ─────────────────────────
CREATE OR REPLACE FUNCTION vanessa.auto_crear_hoja_costos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO vanessa.hoja_costos (orden_id, creado_por)
  VALUES (NEW.id, NEW.creado_por)
  ON CONFLICT (orden_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_crear_hoja_costos
  AFTER INSERT ON vanessa.orden_produccion
  FOR EACH ROW EXECUTE FUNCTION vanessa.auto_crear_hoja_costos();

-- ─── NOTA ─────────────────────────────────────────────────────────────────────
-- Crear bucket 'moldes' manualmente en Supabase Storage con acceso público.
