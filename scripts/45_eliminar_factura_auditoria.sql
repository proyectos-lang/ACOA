-- Rastro de las facturas eliminadas.
--
-- venta_historial.venta_id tiene ON DELETE CASCADE, asi que al borrar una
-- factura desaparecia tambien todo su historial y no quedaba constancia de
-- que habia existido ni de quien la borro. Esta tabla no depende de venta,
-- por eso sobrevive al borrado.

CREATE TABLE IF NOT EXISTS vanessa.venta_eliminada (
  id               SERIAL PRIMARY KEY,
  -- Datos de la factura borrada. No hay FK a venta a proposito: la fila
  -- tiene que quedar cuando la venta ya no exista.
  venta_id         INTEGER NOT NULL,
  numero_documento TEXT NOT NULL,
  fecha            DATE,
  cliente_nombre   TEXT,
  razon_social     TEXT,
  forma_pago       TEXT,
  estado_anterior  TEXT,
  total_valor      NUMERIC,
  total_unidades   INTEGER,
  total_abonado    NUMERIC,
  -- Lineas de la factura al momento de borrarla, para poder reconstruirla
  detalle          JSONB,
  motivo           TEXT,
  eliminado_por    INTEGER REFERENCES vanessa.usuario(id) ON DELETE SET NULL,
  eliminado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venta_eliminada_documento
  ON vanessa.venta_eliminada(numero_documento);
CREATE INDEX IF NOT EXISTS idx_venta_eliminada_fecha
  ON vanessa.venta_eliminada(eliminado_en);

GRANT SELECT, INSERT ON vanessa.venta_eliminada TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE vanessa.venta_eliminada_id_seq TO anon, authenticated, service_role;

-- ── Consecutivo: asegurar la secuencia y sus funciones ──────────────────
--
-- Diagnostico real de la base: ajustar_consecutivo_venta() no existia
-- (PostgREST devolvia 404) y la secuencia estaba en 7 mientras el mayor
-- documento era 958. El codigo seguia funcionando por su respaldo
-- "mayor numero + 1", pero la secuencia quedaba inservible. Esto la deja
-- coherente para que el consecutivo salga de la base y sea atomico.

CREATE SEQUENCE IF NOT EXISTS vanessa.venta_documento_seq AS BIGINT START WITH 1;

-- Entrega el siguiente numero. Atomico: dos usuarios registrando a la vez
-- nunca obtienen el mismo numero.
CREATE OR REPLACE FUNCTION vanessa.siguiente_documento_venta()
RETURNS TEXT
LANGUAGE SQL
VOLATILE
AS $$
  SELECT nextval('vanessa.venta_documento_seq')::TEXT;
$$;

GRANT EXECUTE ON FUNCTION vanessa.siguiente_documento_venta() TO anon, authenticated, service_role;

-- Reajusta la secuencia al mayor documento que exista. Se llama despues de
-- eliminar una factura: al borrar la ultima, su numero vuelve a quedar
-- disponible. Tambien sirve tras cargar ventas historicas.
CREATE OR REPLACE FUNCTION vanessa.ajustar_consecutivo_venta()
RETURNS BIGINT
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  maximo BIGINT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero_documento, '\D', '', 'g'), '')::BIGINT), 0)
    INTO maximo
    FROM vanessa.venta;
  IF maximo > 0 THEN
    PERFORM setval('vanessa.venta_documento_seq', maximo, TRUE);
  ELSE
    PERFORM setval('vanessa.venta_documento_seq', 1, FALSE);
  END IF;
  RETURN maximo;
END $$;

GRANT EXECUTE ON FUNCTION vanessa.ajustar_consecutivo_venta() TO anon, authenticated, service_role;

-- Dejar la secuencia al dia de una vez
SELECT vanessa.ajustar_consecutivo_venta();

-- PostgREST cachea el esquema: recargarlo para que vea lo nuevo
NOTIFY pgrst, 'reload schema';
