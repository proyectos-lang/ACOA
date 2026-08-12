-- ============================================================
-- Script 15: configuración de costos estándar
-- Valores por defecto de los conceptos fijos (cordón, empaque,
-- bandera, corte, …) que se cargan automáticamente en la pestaña
-- Materiales de cada OP; el usuario solo los modifica si aplica.
-- ============================================================

CREATE TABLE IF NOT EXISTS vanessa.config_costos (
  clave           TEXT PRIMARY KEY,
  valor           NUMERIC(14,2) NOT NULL DEFAULT 0,
  actualizado_por INTEGER REFERENCES vanessa.usuario(id),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
