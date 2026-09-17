# Extrae las facturas en PDF de ACOA a un JSON listo para cargar.
# No toca la base de datos: solo lee y reporta.

import glob, json, os, re, sys
from pypdf import PdfReader

CARPETA = r"C:\Users\Personal\Downloads\2026"
SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "facturas.json")

def limpiar(s):
    # El PDF trae la enie mal codificada
    return (
        s.replace("\ufffd", "N").replace("�", "N")
        .replace("NINO", "NIÑO").replace("NINA", "NIÑA")
        .strip()
    )

def numero(s):
    # "2.550.000$" -> 2550000 ; "34.000$" -> 34000
    s = s.replace("$", "").replace(".", "").replace(",", ".").strip()
    try:
        return float(s)
    except ValueError:
        return None

# Linea de detalle: REFERENCIA DESCRIPCION UNIDADES VALOR$ TOTAL$
LINEA = re.compile(
    r"^\s*([A-Za-z0-9\-]+)\s+(.+?)\s+(\d+)\s+([\d.,]+)\s*\$\s+([\d.,]+)\s*\$\s*$"
)
CABECERA = re.compile(r"(\d{1,2}/\d{1,2}/\d{4})\s+(\d+)")

def procesar(ruta):
    nombre = os.path.basename(ruta)
    try:
        texto = PdfReader(ruta).pages[0].extract_text() or ""
    except Exception as e:
        return {"archivo": nombre, "error": f"no se pudo leer: {e}"}

    lineas = [l for l in texto.split("\n") if l.strip()]

    # Fecha y numero de documento
    fecha = documento = None
    for l in lineas[:6]:
        m = CABECERA.search(l)
        if m:
            fecha, documento = m.group(1), m.group(2).lstrip("0") or "0"
            break

    # Condicion de pago y total
    condicion = None
    total_doc = None
    for l in lineas:
        if "NETO A" in l.upper() or "CONTADO" in l.upper():
            mc = re.search(r"NETO A\s*(\d+)\s*DIAS", l.upper())
            condicion = f"credito:{mc.group(1)}" if mc else "contado"
            mt = re.match(r"\s*([\d.,]+)\s*\$", l)
            if mt:
                total_doc = numero(mt.group(1))

    # Cliente: las lineas finales, despues del total, antes de GF/E.AAA
    cola = []
    visto_total = False
    for l in lineas:
        if "NETO A" in l.upper() or "DOCUMENTO N" in l.upper():
            visto_total = True
            continue
        if visto_total:
            t = l.strip()
            # Descartar ruido: marcas del formato, cifras sueltas y montos
            if not t or t in ("GF", "E.AAA", "0") or t.startswith("E.A"):
                continue
            if re.fullmatch(r"[\d.,]+\s*\$?", t):
                continue
            cola.append(limpiar(t))
    cliente = cola[0] if cola else None

    # La ciudad solo se acepta si parece un nombre de lugar, no un monto
    ciudad = None
    if len(cola) > 1:
        cand = cola[1]
        if re.fullmatch(r"[A-Za-zÁÉÍÓÚÑáéíóúñ .#°0-9-]{3,40}", cand) and not re.search(r"\d{3}", cand):
            ciudad = cand.upper()

    # Detalle
    detalle = []
    for l in lineas:
        m = LINEA.match(l)
        if not m:
            continue
        ref, desc, uds, vu, tot = m.groups()
        if ref.upper() in ("REFERENCIA",):
            continue
        detalle.append({
            "referencia": ref.strip().upper(),
            "descripcion": limpiar(desc),
            "unidades": int(uds),
            "valor_unitario": numero(vu),
            "total": numero(tot),
        })

    return {
        "archivo": nombre,
        "documento": documento,
        "fecha": fecha,
        "cliente": cliente,
        "ciudad": ciudad,
        "condicion_pago": condicion,
        "total_documento": total_doc,
        "detalle": detalle,
    }

archivos = sorted(glob.glob(os.path.join(CARPETA, "*.pdf")))
print(f"PDFs encontrados: {len(archivos)}\n")

resultados = [procesar(a) for a in archivos]

# ── Diagnostico ──
sin_doc = [r for r in resultados if not r.get("documento")]
sin_fecha = [r for r in resultados if not r.get("fecha")]
sin_detalle = [r for r in resultados if not r.get("detalle")]
con_error = [r for r in resultados if r.get("error")]

print(f"Con error de lectura:    {len(con_error)}")
print(f"Sin numero de documento: {len(sin_doc)}")
print(f"Sin fecha:               {len(sin_fecha)}")
print(f"Sin lineas de detalle:   {len(sin_detalle)}")

ok = [r for r in resultados if r.get("detalle") and r.get("documento")]
print(f"\nFacturas utilizables:    {len(ok)} de {len(archivos)}")
print(f"Lineas de detalle:       {sum(len(r['detalle']) for r in ok)}")

# Cuadre: suma del detalle vs total del documento
descuadres = []
for r in ok:
    suma = sum(d["total"] or 0 for d in r["detalle"])
    if r["total_documento"] and abs(suma - r["total_documento"]) > 1:
        descuadres.append((r["archivo"], suma, r["total_documento"]))
print(f"Documentos descuadrados: {len(descuadres)}")
for a, s, t in descuadres[:10]:
    print(f"   {a}: detalle={s:,.0f} vs total={t:,.0f}")

# Fechas sospechosas
raras = [r for r in ok if r["fecha"] and not r["fecha"].endswith("2026")]
print(f"\nFechas fuera de 2026:    {len(raras)}")
for r in raras[:10]:
    print(f"   {r['archivo']}: {r['fecha']}")

# Referencias
refs = {}
for r in ok:
    for d in r["detalle"]:
        refs[d["referencia"]] = refs.get(d["referencia"], 0) + 1
print(f"\nReferencias distintas:   {len(refs)}")
print("   " + ", ".join(sorted(refs, key=lambda x: -refs[x])[:25]))

# Clientes
clientes = {}
for r in ok:
    c = r.get("cliente")
    if c:
        clientes[c] = clientes.get(c, 0) + 1
print(f"\nClientes distintos:      {len(clientes)}")
for c in sorted(clientes, key=lambda x: -clientes[x])[:15]:
    print(f"   {clientes[c]:>4}  {c}")

# Totales
total_valor = sum(sum(d["total"] or 0 for d in r["detalle"]) for r in ok)
total_uds = sum(sum(d["unidades"] for d in r["detalle"]) for r in ok)
print(f"\nTOTAL facturado: ${total_valor:,.0f}")
print(f"TOTAL unidades:  {total_uds:,}")

# Condiciones de pago
cond = {}
for r in ok:
    c = r.get("condicion_pago") or "(sin dato)"
    cond[c] = cond.get(c, 0) + 1
print(f"\nCondiciones de pago: {cond}")

with open(SALIDA, "w", encoding="utf-8") as f:
    json.dump(resultados, f, ensure_ascii=False, indent=1)
print(f"\nJSON guardado en: {SALIDA}")
