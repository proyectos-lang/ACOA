-- ============================================================
-- Bloque 2: Asistencia y Nómina — Setup
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Agregar vigente_desde a configuracion_nomina para soporte multi-versión
ALTER TABLE vanessa.configuracion_nomina
  ADD COLUMN IF NOT EXISTS vigente_desde date NOT NULL DEFAULT '2024-01-01';

UPDATE vanessa.configuracion_nomina SET vigente_desde = '2024-01-01' WHERE vigente_desde IS NULL;

-- ----------------------------------------------------------
-- vanessa.festivo
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.festivo (
  id          bigserial PRIMARY KEY,
  fecha       date UNIQUE NOT NULL,
  descripcion text,
  creado_en   timestamptz NOT NULL DEFAULT now(),
  creado_por  bigint
);

-- Festivos Colombia 2025
INSERT INTO vanessa.festivo (fecha, descripcion) VALUES
  ('2025-01-01', 'Año Nuevo'),
  ('2025-01-06', 'Reyes Magos'),
  ('2025-03-24', 'San José'),
  ('2025-04-17', 'Jueves Santo'),
  ('2025-04-18', 'Viernes Santo'),
  ('2025-05-01', 'Día del Trabajo'),
  ('2025-06-02', 'Ascensión del Señor'),
  ('2025-06-23', 'Corpus Christi'),
  ('2025-06-30', 'Sagrado Corazón'),
  ('2025-07-07', 'San Pedro y San Pablo'),
  ('2025-07-20', 'Día de la Independencia'),
  ('2025-08-07', 'Batalla de Boyacá'),
  ('2025-08-18', 'Asunción de la Virgen'),
  ('2025-10-13', 'Día de la Raza'),
  ('2025-11-03', 'Todos los Santos'),
  ('2025-11-17', 'Independencia de Cartagena'),
  ('2025-12-08', 'Inmaculada Concepción'),
  ('2025-12-25', 'Navidad')
ON CONFLICT (fecha) DO NOTHING;

-- Festivos Colombia 2026
INSERT INTO vanessa.festivo (fecha, descripcion) VALUES
  ('2026-01-01', 'Año Nuevo'),
  ('2026-01-12', 'Reyes Magos'),
  ('2026-03-23', 'San José'),
  ('2026-04-02', 'Jueves Santo'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Día del Trabajo'),
  ('2026-05-18', 'Ascensión del Señor'),
  ('2026-06-08', 'Corpus Christi'),
  ('2026-06-15', 'Sagrado Corazón'),
  ('2026-06-29', 'San Pedro y San Pablo'),
  ('2026-07-20', 'Día de la Independencia'),
  ('2026-08-07', 'Batalla de Boyacá'),
  ('2026-08-17', 'Asunción de la Virgen'),
  ('2026-10-12', 'Día de la Raza'),
  ('2026-11-02', 'Todos los Santos'),
  ('2026-11-16', 'Independencia de Cartagena'),
  ('2026-12-08', 'Inmaculada Concepción'),
  ('2026-12-25', 'Navidad')
ON CONFLICT (fecha) DO NOTHING;

-- ----------------------------------------------------------
-- vanessa.marcacion
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.marcacion (
  id         bigserial PRIMARY KEY,
  persona_id bigint NOT NULL REFERENCES vanessa.persona(id) ON DELETE CASCADE,
  documento  varchar(20) NOT NULL,
  fecha_hora timestamptz NOT NULL DEFAULT now(),
  tipo       text NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  creado_en  timestamptz NOT NULL DEFAULT now(),
  creado_por bigint
);

CREATE INDEX IF NOT EXISTS idx_marcacion_persona_fecha ON vanessa.marcacion (persona_id, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_marcacion_fecha ON vanessa.marcacion (fecha_hora);

-- ----------------------------------------------------------
-- vanessa.asistencia_dia
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.asistencia_dia (
  id                bigserial PRIMARY KEY,
  persona_id        bigint NOT NULL REFERENCES vanessa.persona(id) ON DELETE CASCADE,
  fecha             date NOT NULL,
  hora_entrada      time,
  hora_salida       time,
  umbral_horas_extra numeric(5,2) NOT NULL DEFAULT 8,
  horas_trabajadas  numeric(6,2) NOT NULL DEFAULT 0,
  horas_ordinarias  numeric(6,2) NOT NULL DEFAULT 0,
  horas_extra       numeric(6,2) NOT NULL DEFAULT 0,
  horas_nocturnas   numeric(6,2) NOT NULL DEFAULT 0,
  trabajado         boolean NOT NULL DEFAULT false,
  es_festivo        boolean NOT NULL DEFAULT false,
  es_domingo        boolean NOT NULL DEFAULT false,
  observacion       text,
  creado_en         timestamptz NOT NULL DEFAULT now(),
  actualizado_en    timestamptz NOT NULL DEFAULT now(),
  creado_por        bigint,
  UNIQUE (persona_id, fecha)
);

CREATE OR REPLACE TRIGGER trg_asistencia_dia_updated_at
  BEFORE UPDATE ON vanessa.asistencia_dia
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

-- ----------------------------------------------------------
-- vanessa.novedad
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.novedad (
  id             bigserial PRIMARY KEY,
  persona_id     bigint NOT NULL REFERENCES vanessa.persona(id) ON DELETE CASCADE,
  tipo           text NOT NULL CHECK (tipo IN (
                   'falta_justificada','falta_injustificada',
                   'incapacidad','licencia','permiso','vacaciones'
                 )),
  fecha_inicio   date NOT NULL,
  fecha_fin      date NOT NULL,
  observacion    text,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  creado_por     bigint
);

CREATE OR REPLACE TRIGGER trg_novedad_updated_at
  BEFORE UPDATE ON vanessa.novedad
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

-- ----------------------------------------------------------
-- vanessa.periodo_nomina
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.periodo_nomina (
  id           bigserial PRIMARY KEY,
  anio         int NOT NULL,
  mes          int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  quincena     int NOT NULL CHECK (quincena IN (1, 2)),
  fecha_inicio date NOT NULL,
  fecha_fin    date NOT NULL,
  estado       text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'liquidado')),
  creado_en    timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  creado_por   bigint,
  UNIQUE (anio, mes, quincena)
);

CREATE OR REPLACE TRIGGER trg_periodo_nomina_updated_at
  BEFORE UPDATE ON vanessa.periodo_nomina
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

-- ----------------------------------------------------------
-- vanessa.liquidacion
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.liquidacion (
  id              bigserial PRIMARY KEY,
  periodo_id      bigint NOT NULL REFERENCES vanessa.periodo_nomina(id) ON DELETE CASCADE,
  persona_id      bigint NOT NULL REFERENCES vanessa.persona(id) ON DELETE CASCADE,
  tipo_pago       text NOT NULL,
  valor_hora      numeric(14,4),
  valor_dia       numeric(14,4),
  total_devengado numeric(14,2) NOT NULL DEFAULT 0,
  estado          text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'liquidado')),
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  creado_por      bigint,
  UNIQUE (periodo_id, persona_id)
);

CREATE OR REPLACE TRIGGER trg_liquidacion_updated_at
  BEFORE UPDATE ON vanessa.liquidacion
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

-- ----------------------------------------------------------
-- vanessa.liquidacion_detalle
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.liquidacion_detalle (
  id             bigserial PRIMARY KEY,
  liquidacion_id bigint NOT NULL REFERENCES vanessa.liquidacion(id) ON DELETE CASCADE,
  concepto       text NOT NULL,
  descripcion    text,
  cantidad       numeric(10,4) NOT NULL DEFAULT 1,
  valor_unitario numeric(14,4) NOT NULL DEFAULT 0,
  valor_total    numeric(14,2) NOT NULL DEFAULT 0,
  creado_en      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_liq_detalle_liq_id ON vanessa.liquidacion_detalle (liquidacion_id);
