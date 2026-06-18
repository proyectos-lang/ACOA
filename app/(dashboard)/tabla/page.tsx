import { Search, Plus } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Estado = "Pagado" | "Pendiente" | "Parcial"

const rows: {
  id: string
  cliente: string
  fecha: string
  total: string
  estado: Estado
}[] = [
  { id: "FAC-1042", cliente: "Comercial La Ceiba", fecha: "12 Jun 2026", total: "L 18,400", estado: "Pagado" },
  { id: "FAC-1041", cliente: "Distribuidora Norte", fecha: "11 Jun 2026", total: "L 7,250", estado: "Pendiente" },
  { id: "FAC-1040", cliente: "Almacen El Progreso", fecha: "10 Jun 2026", total: "L 32,900", estado: "Parcial" },
  { id: "FAC-1039", cliente: "Tienda Catracha", fecha: "09 Jun 2026", total: "L 4,100", estado: "Pagado" },
  { id: "FAC-1038", cliente: "Mayoreo Sula", fecha: "08 Jun 2026", total: "L 15,600", estado: "Pendiente" },
  { id: "FAC-1037", cliente: "Super Honduras", fecha: "07 Jun 2026", total: "L 9,800", estado: "Pagado" },
]

const badgeClass: Record<Estado, string> = {
  Pagado: "badge-paid",
  Pendiente: "badge-pending",
  Parcial: "badge-partial",
}

export default function TablaPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl">Tabla de datos</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tabla con filas alternas, badges de estado y barra de acciones. Punto de partida para listados.
        </p>
      </header>

      <Card className="card-elevated">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">Facturas recientes</CardTitle>
            <CardDescription>Listado de ejemplo con datos ficticios</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar..." className="h-9 w-full pl-9 sm:w-56" />
            </div>
            <Button className="h-9 gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table className="table-striped">
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-foreground">{row.id}</TableCell>
                    <TableCell>{row.cliente}</TableCell>
                    <TableCell className="text-muted-foreground">{row.fecha}</TableCell>
                    <TableCell className="text-right font-medium">{row.total}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={badgeClass[row.estado]}>{row.estado}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
