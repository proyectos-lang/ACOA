import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  ShoppingBag,
  Activity,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

const kpis = [
  {
    label: "Ingresos del mes",
    value: "L 248,500",
    delta: "+12.5%",
    up: true,
    icon: DollarSign,
  },
  {
    label: "Clientes activos",
    value: "1,284",
    delta: "+4.2%",
    up: true,
    icon: Users,
  },
  {
    label: "Ordenes",
    value: "342",
    delta: "-2.1%",
    up: false,
    icon: ShoppingBag,
  },
  {
    label: "Tasa de conversion",
    value: "3.8%",
    delta: "+0.6%",
    up: true,
    icon: Activity,
  },
]

const goals = [
  { label: "Meta de ventas", value: 72 },
  { label: "Satisfaccion del cliente", value: 91 },
  { label: "Inventario optimo", value: 58 },
]

export default function ShowcasePage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl">Showcase de KPIs</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tarjetas de metrica con la paleta del tema. Reutiliza estos bloques como base para tus dashboards.
        </p>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="card-elevated border-border">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                {kpi.label}
              </CardDescription>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/40">
                <kpi.icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <span className="text-2xl font-bold text-foreground">{kpi.value}</span>
              <span
                className={`flex items-center gap-1 text-xs font-medium ${
                  kpi.up ? "text-primary" : "text-destructive-foreground"
                }`}
                style={kpi.up ? undefined : { color: "#C07A5C" }}
              >
                {kpi.up ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {kpi.delta} vs mes anterior
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Goals + status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="card-elevated lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Progreso de objetivos</CardTitle>
            <CardDescription>Avance del trimestre actual</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {goals.map((goal) => (
              <div key={goal.label} className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{goal.label}</span>
                  <span className="text-muted-foreground">{goal.value}%</span>
                </div>
                <Progress value={goal.value} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-lg">Estados</CardTitle>
            <CardDescription>Ejemplos de badges del tema</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge className="badge-paid">Pagado</Badge>
            <Badge className="badge-pending">Pendiente</Badge>
            <Badge className="badge-partial">Parcial</Badge>
            <Badge variant="secondary">Secundario</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge>Primario</Badge>
            <Badge variant="destructive">Alerta</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
