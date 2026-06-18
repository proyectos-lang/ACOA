"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
} from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const ventasData = [
  { mes: "Ene", ventas: 18600, compras: 12400 },
  { mes: "Feb", ventas: 21200, compras: 14100 },
  { mes: "Mar", ventas: 19800, compras: 13200 },
  { mes: "Abr", ventas: 25400, compras: 16800 },
  { mes: "May", ventas: 28900, compras: 18200 },
  { mes: "Jun", ventas: 31500, compras: 19600 },
]

const traficoData = [
  { dia: "Lun", visitas: 320 },
  { dia: "Mar", visitas: 410 },
  { dia: "Mie", visitas: 380 },
  { dia: "Jue", visitas: 520 },
  { dia: "Vie", visitas: 610 },
  { dia: "Sab", visitas: 740 },
  { dia: "Dom", visitas: 490 },
]

const barChartConfig = {
  ventas: { label: "Ventas", color: "var(--chart-1)" },
  compras: { label: "Compras", color: "var(--chart-2)" },
} satisfies ChartConfig

const lineChartConfig = {
  visitas: { label: "Visitas", color: "var(--chart-1)" },
} satisfies ChartConfig

const areaChartConfig = {
  ventas: { label: "Ventas", color: "var(--chart-1)" },
} satisfies ChartConfig

export default function GraficosPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl">Graficos</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Visualizaciones con shadcn charts y la paleta del tema. Datos de ejemplo.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-lg">Ventas vs Compras</CardTitle>
            <CardDescription>Comparativo mensual</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barChartConfig} className="h-[280px] w-full">
              <BarChart data={ventasData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="ventas" fill="var(--color-ventas)" radius={6} />
                <Bar dataKey="compras" fill="var(--color-compras)" radius={6} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Line chart */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-lg">Trafico semanal</CardTitle>
            <CardDescription>Visitas por dia</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={lineChartConfig} className="h-[280px] w-full">
              <LineChart data={traficoData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="dia" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  dataKey="visitas"
                  type="monotone"
                  stroke="var(--color-visitas)"
                  strokeWidth={2.5}
                  dot={{ fill: "var(--color-visitas)" }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Area chart */}
        <Card className="card-elevated lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Tendencia de ventas</CardTitle>
            <CardDescription>Acumulado de los ultimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={areaChartConfig} className="h-[280px] w-full">
              <AreaChart data={ventasData}>
                <defs>
                  <linearGradient id="fillVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-ventas)" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="var(--color-ventas)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="ventas"
                  type="monotone"
                  stroke="var(--color-ventas)"
                  strokeWidth={2}
                  fill="url(#fillVentas)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
