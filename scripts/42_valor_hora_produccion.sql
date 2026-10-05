-- ============================================================
-- Script 42: valor hora para el personal de produccion
--
-- Las personas de tipo "produccion" se pagan a destajo, pero sus horas
-- extra se liquidan con un valor hora. Se fija en $9.000 y queda
-- configurable, por persona o en la configuracion de nomina.
--
-- La configuracion vive en config_nomina_general, que ya existe.
-- ============================================================

-- OJO: persona.valor_hora NO se puede actualizar. Es una columna generada
-- (GENERATED ALWAYS AS salario / (dias_mes * horas_dia), ver script 01), y
-- Postgres rechaza el UPDATE con:
--   ERROR 428C9: column "valor_hora" can only be updated to DEFAULT
-- Una version anterior de este script lo intentaba y abortaba todo lo que
-- venia despues, dejando la columna de abajo sin crear.
--
-- No hace falta: el personal de produccion cobra a destajo, asi que su
-- salario es 0 y la columna generada queda en NULL. La nomina ya resuelve
-- ese caso usando el valor hora de la configuracion (lib/db/nomina-diaria.ts).

-- Valor hora por defecto del personal de produccion
ALTER TABLE vanessa.config_nomina_general
  ADD COLUMN IF NOT EXISTS valor_hora_produccion NUMERIC NOT NULL DEFAULT 9000;

-- Si la fila existente quedo en cero, se deja en 9.000
UPDATE vanessa.config_nomina_general
   SET valor_hora_produccion = 9000
 WHERE valor_hora_produccion IS NULL OR valor_hora_produccion = 0;

-- Una version anterior de este script creaba una tabla config_nomina que
-- nadie usa: la configuracion real es config_nomina_general. Se retira
-- para no dejar dos fuentes de lo mismo.
DROP TABLE IF EXISTS vanessa.config_nomina;
