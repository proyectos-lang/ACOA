-- ============================================================
-- Script 12: numero_op editable con unicidad garantizada
-- El número de OP ahora se puede editar desde la pestaña General;
-- este constraint evita duplicados a nivel de base de datos.
-- ============================================================

ALTER TABLE vanessa.orden_produccion
  ADD CONSTRAINT orden_produccion_numero_op_uq UNIQUE (numero_op);
