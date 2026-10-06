import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Radar,
  BarChart3,
  History,
  ShoppingCart,
  Package,
  Boxes,
  PackageMinus,
  ClipboardList,
  Database,
  Scissors,
  Printer,
  Layers,
  Hash,
  PackageCheck,
  ClipboardCheck,
  Users,
  UserCheck,
  Clock,
  Calculator,
  Stamp,
  Shirt,
  Wallet,
  Settings,
  SlidersHorizontal,
} from "lucide-react"
import type { PermisoRow } from "@/lib/db/permiso"

// Navegacion del ERP en una sola definicion: la usan el menu lateral, la
// portada y la cabecera. Los modulos van en grupos grandes por area de la
// empresa, cada grupo con su color, para que la persona ubique de un vistazo
// en que parte del sistema esta.

export interface NavItem {
  nombre: string
  href: string
  icon: LucideIcon
  permisoKey: keyof PermisoRow | null
  descripcion: string
}

export interface NavGrupo {
  key: string
  label: string
  descripcion: string
  // Color del grupo (iconos, punto, borde activo) y su version suave (fondos)
  color: string
  colorSuave: string
  items: NavItem[]
}

export const NAV_GRUPOS: NavGrupo[] = [
  {
    key: "gerencia",
    label: "Gerencia y control",
    descripcion: "Lo que la gerencia necesita ver: avance, programado vs real e historial",
    color: "#4f46e5",
    colorSuave: "#eef2ff",
    items: [
      { nombre: "Dashboard", href: "/", icon: LayoutDashboard, permisoKey: null, descripcion: "Inicio y accesos a los módulos" },
      { nombre: "Trazabilidad", href: "/trazabilidad", icon: Radar, permisoKey: "mod_seguimiento", descripcion: "Programado vs real por orden, lote y pieza" },
      { nombre: "Seguimiento", href: "/seguimiento", icon: BarChart3, permisoKey: "mod_seguimiento", descripcion: "Pipeline, lotes activos y cuellos de botella" },
      { nombre: "Historial", href: "/historial", icon: History, permisoKey: "mod_usuarios", descripcion: "Registros de cada proceso, con edición y devolución" },
    ],
  },
  {
    key: "comercial",
    label: "Comercial",
    descripcion: "Ventas, producto terminado, inventario y salidas a clientes",
    color: "#059669",
    colorSuave: "#ecfdf5",
    items: [
      { nombre: "Ventas", href: "/ventas", icon: ShoppingCart, permisoKey: "mod_ventas", descripcion: "Facturación, cartera y registro por empresa" },
      { nombre: "Productos", href: "/productos", icon: Package, permisoKey: "mod_ventas", descripcion: "Maestro de referencias y empresa" },
      { nombre: "Inventario", href: "/inventario", icon: Boxes, permisoKey: "mod_empaque", descripcion: "Producto terminado y movimientos" },
      { nombre: "Órdenes de salida", href: "/inventario/ordenes-salida", icon: PackageMinus, permisoKey: "mod_empaque", descripcion: "Salidas por cliente y su facturación" },
      { nombre: "Conteo físico", href: "/inventario/conteo-fisico", icon: ClipboardCheck, permisoKey: "mod_empaque", descripcion: "Inventario real frente al sistema y ajustes" },
    ],
  },
  {
    key: "produccion",
    label: "Producción",
    descripcion: "De la orden al empaque: corte, estampación, confección y conteo",
    color: "#d97706",
    colorSuave: "#fffbeb",
    items: [
      { nombre: "Orden Producción", href: "/produccion", icon: ClipboardList, permisoKey: "mod_orden_produccion", descripcion: "Fichas, curvas, telas, piezas y lotes" },
      { nombre: "Materiales", href: "/materiales", icon: Database, permisoKey: "mod_orden_produccion", descripcion: "Maestro e inventario de materiales" },
      { nombre: "Corte", href: "/corte", icon: Scissors, permisoKey: "mod_corte", descripcion: "Capas reales y envío al siguiente proceso" },
      { nombre: "Estampación", href: "/estampacion", icon: Printer, permisoKey: "mod_estampacion", descripcion: "Lotes con estampador, fechas y recepción" },
      { nombre: "Confección", href: "/confeccion", icon: Layers, permisoKey: "mod_confeccion", descripcion: "Lotes con confeccionista, fechas y recepción" },
      { nombre: "Conteo", href: "/conteo", icon: Hash, permisoKey: "mod_conteo", descripcion: "Conteo por pieza y talla" },
      { nombre: "Empaque", href: "/empaque", icon: PackageCheck, permisoKey: "mod_empaque", descripcion: "Empaque por pieza, inventario y pago" },
      { nombre: "Liquidación Empaque", href: "/liquidacion-empaque", icon: Calculator, permisoKey: "mod_empaque", descripcion: "Pago a empacadoras por periodo" },
    ],
  },
  {
    key: "personas",
    label: "Personas y nómina",
    descripcion: "Equipo propio, terceros, asistencia y pagos",
    color: "#7c3aed",
    colorSuave: "#f5f3ff",
    items: [
      { nombre: "Personal", href: "/personal", icon: UserCheck, permisoKey: "mod_personal", descripcion: "Headcount y documentos" },
      { nombre: "Asistencia", href: "/asistencia", icon: Clock, permisoKey: "mod_asistencia", descripcion: "Marcaciones, novedades y horas" },
      { nombre: "Nómina", href: "/nomina", icon: Wallet, permisoKey: "mod_nomina", descripcion: "Quincenas y liquidación" },
      { nombre: "Estampadores", href: "/estampadores", icon: Stamp, permisoKey: "mod_personal", descripcion: "Terceros de estampación" },
      { nombre: "Confeccionistas", href: "/confeccionistas", icon: Shirt, permisoKey: "mod_personal", descripcion: "Terceros de confección" },
      { nombre: "Pagos", href: "/pagos", icon: Wallet, permisoKey: "ver_costos", descripcion: "Pagos a estampadores y confeccionistas" },
    ],
  },
  {
    key: "config",
    label: "Configuración",
    descripcion: "Accesos, parámetros y costos",
    color: "#475569",
    colorSuave: "#f1f5f9",
    items: [
      { nombre: "Usuarios", href: "/usuarios", icon: Users, permisoKey: "mod_usuarios", descripcion: "Accesos y permisos por módulo" },
      { nombre: "Configuración", href: "/configuracion", icon: Settings, permisoKey: "mod_configuracion", descripcion: "Parámetros de nómina" },
      { nombre: "Config. Costos", href: "/configuracion-costos", icon: SlidersHorizontal, permisoKey: "ver_costos", descripcion: "Valores de la hoja de costos" },
    ],
  },
]

export function itemsVisibles(grupo: NavGrupo, permiso: PermisoRow | null): NavItem[] {
  return grupo.items.filter((item) => {
    if (!item.permisoKey) return true
    return permiso?.[item.permisoKey] === true
  })
}

export function esRutaActiva(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/")
}

// Grupo y modulo de una ruta. Gana el href mas largo que coincida, para que
// /inventario/ordenes-salida se atribuya a "Ordenes de salida" y no a
// "Inventario".
export function grupoDeRuta(pathname: string): { grupo: NavGrupo; item: NavItem } | null {
  let mejor: { grupo: NavGrupo; item: NavItem } | null = null
  for (const grupo of NAV_GRUPOS) {
    for (const item of grupo.items) {
      if (!esRutaActiva(item.href, pathname)) continue
      if (!mejor || item.href.length > mejor.item.href.length) mejor = { grupo, item }
    }
  }
  return mejor
}
