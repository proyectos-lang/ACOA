-- ============================================================
-- Script 41: ordenes de salida de inventario
--
-- Una orden de salida descuenta producto terminado a nombre de un
-- cliente. Queda con su cabecera y su detalle para consultarla despues,
-- y desde ella se puede generar la venta con los datos precargados.
--
-- Requiere los scripts 34 (inventrans) y 37 (cliente, venta).
-- ============================================================

CREATE TABLE IF NOT EXISTS vanessa.orden_salida (
  id              SERIAL PRIMARY KEY,
  numero          TEXT NOT NULL,
  fecha           DATE NOT NULL,
  cliente_id      INTEGER REFERENCES vanessa.cliente(id) ON DELETE SET NULL,
  cliente_nombre  TEXT NOT NULL,
  ciudad          TEXT,
  -- borrador: aun no descuenta; confirmada: ya descargo inventario
  estado          TEXT NOT NULL DEFAULT 'borrador'
                    CHECK (estado IN ('borrador', 'confirmada', 'anulada')),
  motivo          TEXT NOT NULL DEFAULT 'Despacho a cliente',
  observacion     TEXT,
  total_unidades  INTEGER NOT NULL DEFAULT 0,
  -- Venta generada a partir de esta orden (si ya se facturo)
  venta_id        INTEGER REFERENCES vanessa.venta(id) ON DELETE SET NULL,
  creado_por      INTEGER REFERENCES vanessa.usuario(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmada_en   TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_orden_salida_numero
  ON vanessa.orden_salida (upper(trim(numero)));
CREATE INDEX IF NOT EXISTS idx_orden_salida_fecha ON vanessa.orden_salida(fecha);
CREATE INDEX IF NOT EXISTS idx_orden_salida_cliente ON vanessa.orden_salida(cliente_id);
CREATE INDEX IF NOT EXISTS idx_orden_salida_venta ON vanessa.orden_salida(venta_id);

-- Detalle: el inventario se lleva por referencia + talla
CREATE TABLE IF NOT EXISTS vanessa.orden_salida_detalle (
  id               SERIAL PRIMARY KEY,
  orden_salida_id  INTEGER NOT NULL
                     REFERENCES vanessa.orden_salida(id) ON DELETE CASCADE,
  referencia       TEXT NOT NULL,
  descripcion      TEXT,
  talla            TEXT NOT NULL,
  cantidad         INTEGER NOT NULL CHECK (cantidad > 0),
  -- Movimiento de inventario que genero esta linea al confirmar
  inventrans_id    INTEGER REFERENCES vanessa.inventrans(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_orden_salida_detalle
  ON vanessa.orden_salida_detalle(orden_salida_id);

-- Historial de la orden: que paso, cuando y quien lo hizo
CREATE TABLE IF NOT EXISTS vanessa.orden_salida_historial (
  id               SERIAL PRIMARY KEY,
  orden_salida_id  INTEGER NOT NULL
                     REFERENCES vanessa.orden_salida(id) ON DELETE CASCADE,
  nivel            TEXT NOT NULL DEFAULT 'cabecera'
                     CHECK (nivel IN ('cabecera', 'detalle')),
  accion           TEXT NOT NULL,
  descripcion      TEXT,
  referencia       TEXT,
  talla            TEXT,
  cantidad         INTEGER,
  total_unidades   INTEGER,
  usuario_id       INTEGER REFERENCES vanessa.usuario(id),
  usuario_nombre   TEXT,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_os_historial_orden
  ON vanessa.orden_salida_historial(orden_salida_id);
CREATE INDEX IF NOT EXISTS idx_os_historial_fecha
  ON vanessa.orden_salida_historial(creado_en);

-- La venta sabe de que orden de salida vino, para no facturarla dos veces
ALTER TABLE vanessa.venta
  ADD COLUMN IF NOT EXISTS orden_salida_id INTEGER
    REFERENCES vanessa.orden_salida(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_venta_orden_salida
  ON vanessa.venta(orden_salida_id);

-- Consecutivo del numero de orden de salida
CREATE SEQUENCE IF NOT EXISTS vanessa.orden_salida_seq START WITH 1;

CREATE OR REPLACE FUNCTION vanessa.siguiente_orden_salida()
RETURNS TEXT
LANGUAGE SQL
VOLATILE
AS $$
  SELECT 'OS-' || lpad(nextval('vanessa.orden_salida_seq')::TEXT, 5, '0');
$$;

GRANT EXECUTE ON FUNCTION vanessa.siguiente_orden_salida()
  TO anon, authenticated, service_role;
