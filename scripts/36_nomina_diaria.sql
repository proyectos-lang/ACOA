-- ============================================================
-- Script 36: nomina diaria y configuracion de pago por empaque
--
-- 1) config_nomina_general: parametros de la empresa (valor por prenda
--    empacada, salario minimo, auxilio de transporte y porcentajes de
--    ley) ajustados a la normativa colombiana 2026 (Ley 2466 de 2025).
-- 2) cierre_nomina_dia: cierre del pago diario por persona, para dejar
--    registrado lo liquidado dia a dia.
-- ============================================================

CREATE TABLE IF NOT EXISTS vanessa.config_nomina_general (
  id                     SERIAL PRIMARY KEY,
  vigente_desde          DATE NOT NULL,
  -- Pago a destajo del personal de empaque
  valor_prenda_empaque   NUMERIC NOT NULL DEFAULT 0,
  -- Parametros legales (Colombia 2026)
  salario_minimo         NUMERIC NOT NULL DEFAULT 0,
  auxilio_transporte     NUMERIC NOT NULL DEFAULT 0,
  -- Tope de salarios minimos para tener derecho a auxilio de transporte
  tope_auxilio_smmlv     NUMERIC NOT NULL DEFAULT 2,
  -- Aportes del trabajador
  porc_salud_empleado    NUMERIC NOT NULL DEFAULT 4,
  porc_pension_empleado  NUMERIC NOT NULL DEFAULT 4,
  -- Aportes del empleador
  porc_salud_empleador   NUMERIC NOT NULL DEFAULT 8.5,
  porc_pension_empleador NUMERIC NOT NULL DEFAULT 12,
  porc_arl               NUMERIC NOT NULL DEFAULT 0.522,
  porc_caja              NUMERIC NOT NULL DEFAULT 4,
  porc_icbf              NUMERIC NOT NULL DEFAULT 3,
  porc_sena              NUMERIC NOT NULL DEFAULT 2,
  -- Prestaciones sociales
  porc_cesantias         NUMERIC NOT NULL DEFAULT 8.33,
  porc_int_cesantias     NUMERIC NOT NULL DEFAULT 1,
  porc_prima             NUMERIC NOT NULL DEFAULT 8.33,
  porc_vacaciones        NUMERIC NOT NULL DEFAULT 4.17,
  -- Dia de descanso remunerado al completar la semana
  dias_semana_para_dominical INTEGER NOT NULL DEFAULT 6,
  creado_por             INTEGER REFERENCES vanessa.usuario(id),
  creado_en              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Valores vigentes 2026 (Colombia). El valor por prenda empacada se
-- ajusta desde la pestana Configuracion del modulo de Nomina.
INSERT INTO vanessa.config_nomina_general (
  vigente_desde, valor_prenda_empaque, salario_minimo, auxilio_transporte
)
SELECT '2026-01-01', 0, 1750905, 200000
WHERE NOT EXISTS (SELECT 1 FROM vanessa.config_nomina_general);

CREATE TABLE IF NOT EXISTS vanessa.cierre_nomina_dia (
  id            SERIAL PRIMARY KEY,
  persona_id    INTEGER NOT NULL REFERENCES vanessa.persona(id) ON DELETE CASCADE,
  fecha         DATE NOT NULL,
  valor_pagado  NUMERIC NOT NULL DEFAULT 0,
  observacion   TEXT,
  cerrado_por   INTEGER REFERENCES vanessa.usuario(id),
  cerrado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cierre_nomina_dia
  ON vanessa.cierre_nomina_dia (persona_id, fecha);
