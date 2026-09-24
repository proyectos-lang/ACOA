-- ============================================================
-- Script 42: valor hora para el personal de produccion
--
-- Las personas de tipo "produccion" se pagan a destajo, pero sus horas
-- (extras y recargos) se liquidan con un valor hora. Se fija en $9.000
-- y queda configurable desde Nomina.
--
-- Este script tambien crea config_nomina si no existe: sin ella el pago
-- por empaque quedaba en cero porque no habia valor por prenda.
-- ============================================================

-- Valor hora de las personas de produccion que aun no lo tengan
UPDATE vanessa.persona
   SET valor_hora = 9000
 WHERE tipo_pago = 'produccion'
   AND (valor_hora IS NULL OR valor_hora = 0);

-- ── Configuracion general de nomina ──
CREATE TABLE IF NOT EXISTS vanessa.config_nomina (
  id                          SERIAL PRIMARY KEY,
  -- Lo que se le paga a la empacadora por prenda empacada
  valor_prenda_empaque        NUMERIC NOT NULL DEFAULT 0,
  -- Valor hora por defecto del personal de produccion
  valor_hora_produccion       NUMERIC NOT NULL DEFAULT 9000,
  -- Dias de la semana que hay que trabajar para que el domingo se pague
  dias_semana_para_dominical  INTEGER NOT NULL DEFAULT 6,
  -- Recargo dominical/festivo (Ley 2466 de 2026)
  factor_dominical            NUMERIC NOT NULL DEFAULT 1.9,
  -- Aportes del trabajador
  porc_salud                  NUMERIC NOT NULL DEFAULT 4,
  porc_pension                NUMERIC NOT NULL DEFAULT 4,
  -- Aportes del empleador
  porc_pension_empleador      NUMERIC NOT NULL DEFAULT 12,
  porc_arl                    NUMERIC NOT NULL DEFAULT 0.522,
  porc_caja                   NUMERIC NOT NULL DEFAULT 4,
  porc_icbf                   NUMERIC NOT NULL DEFAULT 3,
  porc_sena                   NUMERIC NOT NULL DEFAULT 2,
  porc_cesantias              NUMERIC NOT NULL DEFAULT 8.33,
  porc_int_cesantias          NUMERIC NOT NULL DEFAULT 1,
  porc_prima                  NUMERIC NOT NULL DEFAULT 8.33,
  porc_vacaciones             NUMERIC NOT NULL DEFAULT 4.17,
  -- Referencias 2026
  smmlv                       NUMERIC NOT NULL DEFAULT 1750905,
  auxilio_transporte          NUMERIC NOT NULL DEFAULT 200000,
  actualizado_en              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_por             INTEGER REFERENCES vanessa.usuario(id)
);

-- Una sola fila de configuracion
INSERT INTO vanessa.config_nomina (id)
SELECT 1
 WHERE NOT EXISTS (SELECT 1 FROM vanessa.config_nomina);

-- Si la tabla ya existia sin la columna nueva, se agrega
ALTER TABLE vanessa.config_nomina
  ADD COLUMN IF NOT EXISTS valor_hora_produccion NUMERIC NOT NULL DEFAULT 9000;
