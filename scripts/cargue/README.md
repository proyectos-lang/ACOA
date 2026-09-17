# Cargue de facturas desde PDF

Herramienta para cargar facturas históricas de ACOA que están en PDF
(las que genera la plantilla de Excel y se exportan a PDF).

## Cómo se usa

Requiere `pypdf`: `python -m pip install pypdf`

**1. Extraer** — lee los PDF y deja un `facturas.json` junto al script.
No toca la base de datos.

```
python scripts/cargue/extraer_facturas_pdf.py
```

La carpeta de entrada está en la constante `CARPETA` al inicio del
archivo. Al terminar imprime un diagnóstico: cuántas facturas se
leyeron, documentos descuadrados, fechas raras, clientes y referencias
encontradas, y el total facturado. **Revisa ese reporte antes de
cargar.**

**2. Cargar** — simula por defecto; solo escribe con `--aplicar`.

```
node scripts/cargue/cargar_facturas_pdf.mjs            # simula
node scripts/cargue/cargar_facturas_pdf.mjs --aplicar  # escribe
```

## Qué hace el cargue

- **No pisa lo que ya existe**: omite los documentos cuyo número ya está
  en `venta`.
- **Duplicados**: cuando dos archivos son el mismo documento, gana el
  que diga `CORREGIDA`/`CORREGIDO` en el nombre. El número se toma del
  nombre del archivo, que es más confiable que el del contenido.
- **Fechas**: normaliza `d/m/aaaa` a ISO. Los años anteriores a 2026
  (1900, 2025) son errores de digitación del PDF y se corrigen a 2026.
- **Condición de pago**: `NETO A 30 DIAS` entra como crédito a 30 días.
- **No mueve inventario**: son ventas históricas, la mercancía ya salió.
  Cargarlas descontando dejaría el inventario en negativo.
- Crea los clientes y las referencias de venta que falten.

## Trazabilidad

Cada venta cargada así queda con `observacion` iniciando en
**"Cargue PDF 2026"** más el nombre del archivo de origen. Eso permite
distinguirlas de las que vinieron del Excel CARTERA y, si hace falta,
revertir solo este cargue:

```sql
-- Ver lo cargado desde PDF
SELECT numero_documento, fecha, cliente_nombre, total_valor, observacion
  FROM vanessa.venta
 WHERE observacion LIKE 'Cargue PDF 2026%';

-- Revertir SOLO este cargue (el detalle cae por CASCADE)
DELETE FROM vanessa.venta WHERE observacion LIKE 'Cargue PDF 2026%';
```

Las del Excel llevan `observacion = 'Cargue historico CARTERA 2026'`.
