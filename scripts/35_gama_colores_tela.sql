-- ============================================================
-- Script 35: gama de colores estandar por tela
-- Cada material tipo Tela tiene una gama de colores preestablecida.
-- Al seleccionar la tela en la Curva de una OP, los colores se cargan
-- automaticamente en lugar de escribirlos a mano.
--
-- La gama inicial se derivo de los colores usados historicamente en
-- op_tela (solo los usados 2 o mas veces, con las erratas corregidas).
-- ============================================================

CREATE TABLE IF NOT EXISTS vanessa.tela_color (
  id          SERIAL PRIMARY KEY,
  material_id INTEGER NOT NULL REFERENCES vanessa.material(id) ON DELETE CASCADE,
  color       TEXT NOT NULL,
  orden       INTEGER NOT NULL DEFAULT 0,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por  INTEGER REFERENCES vanessa.usuario(id),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un color no se repite dentro de la misma tela
CREATE UNIQUE INDEX IF NOT EXISTS uq_tela_color
  ON vanessa.tela_color (material_id, upper(trim(color)));

CREATE INDEX IF NOT EXISTS idx_tela_color_material ON vanessa.tela_color(material_id);

-- ── Carga inicial de la gama por tela ───────────────────────
-- Se insertan por nombre de material para que funcione con los ids reales.
INSERT INTO vanessa.tela_color (material_id, color, orden)
SELECT m.id, g.color, g.orden
FROM (VALUES
  -- LICRA FRIA
  ('LICRA FRIA','APT',1),('LICRA FRIA','NEGRO',2),('LICRA FRIA','BLANCO',3),
  ('LICRA FRIA','ROJO',4),('LICRA FRIA','AMARILLO',5),('LICRA FRIA','ARENA',6),
  ('LICRA FRIA','CHOCOLATE',7),('LICRA FRIA','VERDE MILITAR',8),('LICRA FRIA','GRIS JASPE',9),
  ('LICRA FRIA','CUPER',10),('LICRA FRIA','GRIS PLATA',11),('LICRA FRIA','AZUL HORTENCIA',12),
  ('LICRA FRIA','AZUL BOSS',13),('LICRA FRIA','VERDE BOTELLA',14),('LICRA FRIA','MANTEQUILLA',15),
  ('LICRA FRIA','GRIS OSCURO',16),('LICRA FRIA','VERDE OLIVA',17),('LICRA FRIA','CAFE MEDIO',18),
  ('LICRA FRIA','AZUL CLARO',19),('LICRA FRIA','CRUDO',20),('LICRA FRIA','CREMA',21),
  ('LICRA FRIA','PETROLEO',22),('LICRA FRIA','ROJO/NEGRO',23),('LICRA FRIA','APT/AMARILLO',24),
  ('LICRA FRIA','HORTENCIA/GRIS',25),('LICRA FRIA','ROJO/VERDE MILITAR',26),

  -- RIB
  ('RIB','NEGRO',1),('RIB','APT',2),('RIB','BLANCO',3),('RIB','ARENA',4),
  ('RIB','GRIS PLATA',5),('RIB','CUPER',6),('RIB','VERDE MILITAR',7),('RIB','CHOCOLATE',8),
  ('RIB','AMARILLO',9),('RIB','AZUL BOSS',10),('RIB','ROJO',11),('RIB','GRIS JASPE',12),
  ('RIB','AZUL HORTENCIA',13),('RIB','MANTEQUILLA',14),('RIB','AZUL CLARO',15),
  ('RIB','VERDE BOTELLA',16),('RIB','GRIS OSCURO',17),('RIB','VERDE OLIVA',18),
  ('RIB','CAMEL',19),('RIB','VERDE',20),('RIB','CAFE MEDIO',21),('RIB','CAFE',22),
  ('RIB','CRUDO',23),('RIB','TABACO',24),('RIB','ROJO/NEGRO',25),('RIB','APT/AMARILLO',26),
  ('RIB','HORTENCIA/GRIS',27),('RIB','ROJO/VERDE MILITAR',28),

  -- QATAR
  ('QATAR','NEGRO',1),('QATAR','BLANCO',2),('QATAR','CUPER',3),('QATAR','GRIS PLATA',4),
  ('QATAR','ARENA',5),('QATAR','APT',6),('QATAR','AZUL HORTENCIA',7),('QATAR','CHOCOLATE',8),
  ('QATAR','VERDE OLIVA',9),('QATAR','AZUL BOSS',10),('QATAR','MANTEQUILLA',11),
  ('QATAR','AMARILLO',12),('QATAR','GRIS OSCURO',13),('QATAR','VERDE',14),
  ('QATAR','ROJO',15),('QATAR','VERDE MILITAR',16),

  -- BURDA LAUREL
  ('BURDA LAUREL','ARENA',1),('BURDA LAUREL','VERDE OLIVA',2),('BURDA LAUREL','APT',3),
  ('BURDA LAUREL','AZUL CLARO',4),('BURDA LAUREL','ROSADO',5),('BURDA LAUREL','NEGRO',6),
  ('BURDA LAUREL','AMARILLO',7),('BURDA LAUREL','MANTEQUILLA',8),('BURDA LAUREL','VERDE MENTA',9),
  ('BURDA LAUREL','LILA',10),('BURDA LAUREL','MELON',11),('BURDA LAUREL','BARBIE',12),
  ('BURDA LAUREL','ROSADO CLARO',13),('BURDA LAUREL','ROSADO BEBE',14),
  ('BURDA LAUREL','VERDE MILITAR',15),('BURDA LAUREL','VERDE BOTELLA',16),
  ('BURDA LAUREL','ROJO',17),('BURDA LAUREL','GRIS JASPE',18),('BURDA LAUREL','GRIS PLATA',19),
  ('BURDA LAUREL','CAMEL',20),('BURDA LAUREL','AZUL BOSS',21),

  -- BURDA NUEVA PERLA
  ('BURDA NUEVA PERLA','VERDE OLIVA',1),('BURDA NUEVA PERLA','ARENA',2),
  ('BURDA NUEVA PERLA','AZUL CLARO',3),('BURDA NUEVA PERLA','NEGRO',4),
  ('BURDA NUEVA PERLA','MANTEQUILLA',5),('BURDA NUEVA PERLA','APT',6),
  ('BURDA NUEVA PERLA','GRIS PLATA',7),('BURDA NUEVA PERLA','VERDE MILITAR',8),
  ('BURDA NUEVA PERLA','ROSADO',9),('BURDA NUEVA PERLA','ROSADO BEBE',10),
  ('BURDA NUEVA PERLA','AMARILLO',11),('BURDA NUEVA PERLA','CAMEL',12),
  ('BURDA NUEVA PERLA','VERDE MENTA',13),('BURDA NUEVA PERLA','TABACO',14),
  ('BURDA NUEVA PERLA','AZUL BOSS',15),('BURDA NUEVA PERLA','VERDE BOTELLA',16),
  ('BURDA NUEVA PERLA','CUPER',17),('BURDA NUEVA PERLA','BLANCO',18),
  ('BURDA NUEVA PERLA','AZUL HORTENCIA',19),

  -- LICRA SALOME
  ('LICRA SALOME','APT',1),('LICRA SALOME','BLANCO',2),('LICRA SALOME','VERDE MENTA',3),
  ('LICRA SALOME','LILA',4),('LICRA SALOME','GRIS JASPE',5),('LICRA SALOME','ROSADO',6),
  ('LICRA SALOME','MANTEQUILLA',7),('LICRA SALOME','AZUL CLARO',8),('LICRA SALOME','MELON',9),
  ('LICRA SALOME','ROSADO BEBE',10),('LICRA SALOME','BARBIE',11),('LICRA SALOME','ROSADO BARBIE',12),

  -- DRIL
  ('DRIL','BEIGE MEDIO',1),('DRIL','NEGRO',2),('DRIL','VERDE MILITAR',3),
  ('DRIL','AZUL OSCURO',4),('DRIL','VERDE OLIVA',5),('DRIL','CHOCOLATE',6),
  ('DRIL','CUPER',7),('DRIL','KAKI CLARO',8)
) AS g(tela, color, orden)
JOIN vanessa.material m
  ON upper(trim(m.nombre)) = g.tela
 AND lower(trim(m.tipo)) = 'tela'
ON CONFLICT DO NOTHING;
