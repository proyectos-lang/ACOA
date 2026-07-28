-- ─── Permitir tallas repetidas en la curva ──────────────────────────────────
-- La curva puede llevar la misma talla más de una vez (ej. 4/6/8/10/12/14/16/16:
-- la última talla produce 2 unidades por capa), igual que en la planilla física.
-- Se elimina la restricción de unicidad agregada en el script 06.

ALTER TABLE vanessa.curva_talla
  DROP CONSTRAINT IF EXISTS curva_talla_orden_talla_uq;
