-- ============================================================
-- Script 17: reparar corte_tela — numero_tallas → capas
-- La sección 5b del script 06 no se aplicó en la base: corte_tela
-- conserva numero_tallas y el código consulta capas, lo que rompe
-- la ficha de Corte ("column corte_tela.capas does not exist").
-- Idempotente: cubre ambos estados posibles de la tabla.
-- ============================================================

DO $$
BEGIN
  -- Caso 1: conversión pendiente (existe numero_tallas)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'vanessa' AND table_name = 'corte_tela' AND column_name = 'numero_tallas'
  ) THEN
    -- promedio_consumo GENERATED depende de numero_tallas: eliminar primero
    ALTER TABLE vanessa.corte_tela DROP COLUMN IF EXISTS promedio_consumo;
    ALTER TABLE vanessa.corte_tela ADD COLUMN IF NOT EXISTS capas INTEGER;
    EXECUTE 'UPDATE vanessa.corte_tela SET capas = numero_tallas WHERE capas IS NULL';
    ALTER TABLE vanessa.corte_tela DROP COLUMN numero_tallas;
  END IF;

  -- Caso 2: no existe capas (tabla sin numero_tallas ni capas)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'vanessa' AND table_name = 'corte_tela' AND column_name = 'capas'
  ) THEN
    ALTER TABLE vanessa.corte_tela ADD COLUMN capas INTEGER;
  END IF;

  -- Asegurar promedio_consumo generado desde capas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'vanessa' AND table_name = 'corte_tela' AND column_name = 'promedio_consumo'
  ) THEN
    ALTER TABLE vanessa.corte_tela ADD COLUMN promedio_consumo NUMERIC(10,4)
      GENERATED ALWAYS AS (ROUND(largo_trazo / NULLIF(capas::numeric, 0), 4)) STORED;
  END IF;
END $$;
