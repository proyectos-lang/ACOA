-- ============================================================
-- Esquema vanessa — Setup inicial
-- Ejecutar en Supabase SQL Editor (Project: qpwjwfparpupfyuxoskx)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS vanessa;

-- ----------------------------------------------------------
-- vanessa.persona
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.persona (
  id             bigserial PRIMARY KEY,
  documento      varchar(20) UNIQUE NOT NULL,
  nombre         text NOT NULL,
  cargo          text,
  salario        numeric(14,2) NOT NULL DEFAULT 0,
  tipo_pago      text NOT NULL CHECK (tipo_pago IN ('salario', 'turno', 'produccion')),
  dias_mes       int NOT NULL DEFAULT 30,
  horas_dia      numeric(5,2) NOT NULL DEFAULT 8,
  valor_hora     numeric(14,4) GENERATED ALWAYS AS (
                   CASE
                     WHEN dias_mes > 0 AND horas_dia > 0 AND salario > 0
                     THEN ROUND(salario / (dias_mes::numeric * horas_dia), 4)
                     ELSE NULL
                   END
                 ) STORED,
  fecha_ingreso  date,
  estado         text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  url_cedula     text,
  url_contrato   text,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  creado_por     bigint
);

-- ----------------------------------------------------------
-- vanessa.usuario
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.usuario (
  id              bigserial PRIMARY KEY,
  nombre_usuario  varchar(50) UNIQUE NOT NULL,
  contrasena_hash text NOT NULL,
  nombre_completo text,
  activo          boolean NOT NULL DEFAULT true,
  persona_id      bigint REFERENCES vanessa.persona(id) ON DELETE SET NULL,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  creado_por      bigint
);

-- ----------------------------------------------------------
-- vanessa.permiso
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.permiso (
  id                   bigserial PRIMARY KEY,
  usuario_id           bigint UNIQUE NOT NULL REFERENCES vanessa.usuario(id) ON DELETE CASCADE,
  mod_configuracion    boolean NOT NULL DEFAULT false,
  mod_usuarios         boolean NOT NULL DEFAULT false,
  mod_personal         boolean NOT NULL DEFAULT false,
  mod_asistencia       boolean NOT NULL DEFAULT false,
  mod_nomina           boolean NOT NULL DEFAULT false,
  mod_orden_produccion boolean NOT NULL DEFAULT false,
  mod_diseno           boolean NOT NULL DEFAULT false,
  mod_corte            boolean NOT NULL DEFAULT false,
  mod_estampacion      boolean NOT NULL DEFAULT false,
  mod_confeccion       boolean NOT NULL DEFAULT false,
  mod_conteo           boolean NOT NULL DEFAULT false,
  mod_empaque          boolean NOT NULL DEFAULT false,
  ver_costos           boolean NOT NULL DEFAULT false,
  creado_en            timestamptz NOT NULL DEFAULT now(),
  actualizado_en       timestamptz NOT NULL DEFAULT now(),
  creado_por           bigint
);

-- ----------------------------------------------------------
-- vanessa.configuracion_nomina
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS vanessa.configuracion_nomina (
  id                        bigserial PRIMARY KEY,
  umbral_horas_extra_diario numeric(5,2) NOT NULL DEFAULT 8,
  factor_extra_diurna       numeric(6,4) NOT NULL DEFAULT 1.25,
  factor_extra_nocturna     numeric(6,4) NOT NULL DEFAULT 1.75,
  factor_recargo_nocturno   numeric(6,4) NOT NULL DEFAULT 1.35,
  factor_dominical_festivo  numeric(6,4) NOT NULL DEFAULT 1.75,
  hora_inicio_nocturno      time NOT NULL DEFAULT '21:00:00',
  hora_fin_nocturno         time NOT NULL DEFAULT '06:00:00',
  vigente                   boolean NOT NULL DEFAULT true,
  creado_en                 timestamptz NOT NULL DEFAULT now(),
  actualizado_en            timestamptz NOT NULL DEFAULT now(),
  creado_por                bigint
);

-- Fila inicial de configuración de nómina
INSERT INTO vanessa.configuracion_nomina DEFAULT VALUES
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------
-- Trigger: actualiza actualizado_en automáticamente
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION vanessa.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_persona_updated_at
  BEFORE UPDATE ON vanessa.persona
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

CREATE OR REPLACE TRIGGER trg_usuario_updated_at
  BEFORE UPDATE ON vanessa.usuario
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

CREATE OR REPLACE TRIGGER trg_permiso_updated_at
  BEFORE UPDATE ON vanessa.permiso
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

CREATE OR REPLACE TRIGGER trg_config_nomina_updated_at
  BEFORE UPDATE ON vanessa.configuracion_nomina
  FOR EACH ROW EXECUTE FUNCTION vanessa.set_updated_at();

-- ----------------------------------------------------------
-- Bucket de Storage: documentos-personal
-- Ejecutar por separado si el bucket no existe:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documentos-personal', 'documentos-personal', true);
-- ----------------------------------------------------------
