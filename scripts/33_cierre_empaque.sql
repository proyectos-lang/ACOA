-- ============================================================
-- Script 33: cierre diario de empaque por persona
-- Registra el cierre del dia de lo que empaco cada persona, para que
-- el modulo Liquidacion Empaque muestre que dias ya estan cerrados.
-- El detalle (tallas y cantidades) se lee de empaque_registro.
-- ============================================================

CREATE TABLE IF NOT EXISTS vanessa.cierre_empaque (
  id            SERIAL PRIMARY KEY,
  persona_id    INTEGER NOT NULL REFERENCES vanessa.persona(id) ON DELETE CASCADE,
  fecha         DATE NOT NULL,
  total_unidades  INTEGER NOT NULL DEFAULT 0,
  total_imperfectos INTEGER NOT NULL DEFAULT 0,
  total_valor   NUMERIC NOT NULL DEFAULT 0,
  observacion   TEXT,
  cerrado_por   INTEGER REFERENCES vanessa.usuario(id),
  cerrado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un solo cierre por persona y dia
CREATE UNIQUE INDEX IF NOT EXISTS uq_cierre_empaque_persona_fecha
  ON vanessa.cierre_empaque (persona_id, fecha);
