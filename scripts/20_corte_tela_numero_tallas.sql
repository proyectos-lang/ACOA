-- ============================================================
-- Script 20: número de tallas en la ficha de corte por tela
-- Se reemplaza el uso de "rendimiento" en la ficha por "número
-- de tallas", y el promedio de consumo pasa a calcularse como
--   promedio_consumo = largo_trazo / numero_tallas
-- (la columna rendimiento se conserva en la tabla, solo sale de
-- la interfaz).
-- ============================================================

ALTER TABLE vanessa.corte_tela
  ADD COLUMN IF NOT EXISTS numero_tallas INTEGER;

ALTER TABLE vanessa.corte_tela
  DROP COLUMN IF EXISTS promedio_consumo;

ALTER TABLE vanessa.corte_tela
  ADD COLUMN promedio_consumo NUMERIC(10,4)
    GENERATED ALWAYS AS (ROUND(largo_trazo / NULLIF(numero_tallas::numeric, 0), 4)) STORED;
