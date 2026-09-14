-- ============================================================
-- Script 37: modulo de Ventas (cartera)
--
-- Replica el formato del archivo CARTERA 2026: cada venta es un
-- documento (factura) de un cliente en una ciudad/sucursal, con una o
-- mas lineas de referencia, cantidad y valor unitario.
--
-- Al confirmar una venta, cada linea descuenta del inventario de
-- producto terminado mediante una salida en inventrans.
-- ============================================================

-- Permiso del modulo de Ventas
ALTER TABLE vanessa.permiso
  ADD COLUMN IF NOT EXISTS mod_ventas BOOLEAN NOT NULL DEFAULT FALSE;

-- Quien ya administra usuarios entra a Ventas sin reconfigurar permisos
UPDATE vanessa.permiso SET mod_ventas = TRUE WHERE mod_usuarios = TRUE;

-- Clientes con sus sucursales/ciudades
CREATE TABLE IF NOT EXISTS vanessa.cliente (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  ciudad      TEXT,
  nit         TEXT,
  telefono    TEXT,
  direccion   TEXT,
  contacto    TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por  INTEGER REFERENCES vanessa.usuario(id),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cliente_nombre_ciudad
  ON vanessa.cliente (upper(trim(nombre)), upper(trim(coalesce(ciudad, ''))));

-- Precio de venta y clasificacion por referencia
CREATE TABLE IF NOT EXISTS vanessa.referencia_venta (
  id            SERIAL PRIMARY KEY,
  referencia    TEXT NOT NULL,
  descripcion   TEXT,
  linea         TEXT,
  categoria     TEXT,
  valor_unidad  NUMERIC NOT NULL DEFAULT 0,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por    INTEGER REFERENCES vanessa.usuario(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_referencia_venta
  ON vanessa.referencia_venta (upper(trim(referencia)));

-- Venta: un documento por cliente y fecha
CREATE TABLE IF NOT EXISTS vanessa.venta (
  id                SERIAL PRIMARY KEY,
  numero_documento  TEXT NOT NULL,
  fecha             DATE NOT NULL,
  cliente_id        INTEGER REFERENCES vanessa.cliente(id) ON DELETE SET NULL,
  cliente_nombre    TEXT NOT NULL,
  ciudad            TEXT,
  -- borrador: aun no descuenta inventario; confirmada: ya descargo
  estado            TEXT NOT NULL DEFAULT 'borrador'
                      CHECK (estado IN ('borrador', 'confirmada', 'anulada')),
  total_unidades    INTEGER NOT NULL DEFAULT 0,
  total_valor       NUMERIC NOT NULL DEFAULT 0,
  observacion       TEXT,
  creado_por        INTEGER REFERENCES vanessa.usuario(id),
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmada_en     TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_venta_documento
  ON vanessa.venta (upper(trim(numero_documento)));
CREATE INDEX IF NOT EXISTS idx_venta_fecha ON vanessa.venta(fecha);
CREATE INDEX IF NOT EXISTS idx_venta_cliente ON vanessa.venta(cliente_id);

-- Lineas de la venta: referencia, talla, cantidad y valor
CREATE TABLE IF NOT EXISTS vanessa.venta_detalle (
  id            SERIAL PRIMARY KEY,
  venta_id      INTEGER NOT NULL REFERENCES vanessa.venta(id) ON DELETE CASCADE,
  referencia    TEXT NOT NULL,
  descripcion   TEXT,
  linea         TEXT,
  categoria     TEXT,
  -- La talla permite descontar del inventario, que se lleva por
  -- referencia + talla. Si la venta no la detalla queda vacia.
  talla         TEXT,
  cantidad      INTEGER NOT NULL,
  valor_unidad  NUMERIC NOT NULL DEFAULT 0,
  valor_total   NUMERIC NOT NULL DEFAULT 0,
  -- Movimiento de inventario que genero esta linea al confirmar
  inventrans_id INTEGER REFERENCES vanessa.inventrans(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_venta_detalle_venta ON vanessa.venta_detalle(venta_id);

-- Precios de referencia tomados del formato actual (CARTERA 2026)
INSERT INTO vanessa.referencia_venta (referencia, descripcion, linea, categoria, valor_unidad)
SELECT * FROM (VALUES
  ('910',  'LICRA FRIA',            'CAMISETA', 'NIÑO',   14000),
  ('911',  'LICRA FRIA',            'CAMISETA', 'NIÑO',   14000),
  ('912',  'CAMISETA NIÑO TEXTURA', 'CAMISETA', 'NIÑO',   21000),
  ('960',  'TELA FRIA',             'CONJUNTO', 'NIÑA',   20000),
  ('961',  'BURDA SALOME',          'CONJUNTO', 'NIÑA',   24000),
  ('962',  'BURDA SALOME',          'CONJUNTO', 'NIÑA',   21000),
  ('991',  'LICRA FRIA',            'CAMISETA', 'DAMA',   14000),
  ('992',  'LICRA FRIA',            'CAMISETA', 'DAMA',   14000),
  ('1900', 'BURDA FRIA',            'CONJUNTO', 'HOMBRE', 32000),
  ('1950', 'BURDA',                 'CONJUNTO', 'HOMBRE', 27000),
  ('5001', 'BURDA BURDA',           'CONJUNTO', 'NIÑO',   26500),
  ('5002', 'BURDA BURDA',           'CONJUNTO', 'NIÑO',   26500),
  ('6000', 'DRIL',                  'CONJUNTO', 'NIÑO',   34000),
  ('7000', 'QATAR',                 'CONJUNTO', 'NIÑO',   32000),
  ('8000', 'QATAR',                 'CONJUNTO', 'NIÑO',   32000)
) AS v(referencia, descripcion, linea, categoria, valor_unidad)
WHERE NOT EXISTS (SELECT 1 FROM vanessa.referencia_venta);
