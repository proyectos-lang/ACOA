"use client"

import * as React from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Pencil, Trash2, FileText, Loader2, Search, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { crearPersonaAction, editarPersonaAction, eliminarPersonaAction } from "@/app/(dashboard)/personal/actions"
import type { PersonaRow } from "@/lib/db/persona"

// ---------------------------------------------------------------------------
// Utilidades COP
// ---------------------------------------------------------------------------
function formatCOP(value: number | null | undefined): string {
  if (value == null) return "—"
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function parseCOP(raw: string): number {
  return parseFloat(raw.replace(/[^\d,]/g, "").replace(",", ".")) || 0
}

// ---------------------------------------------------------------------------
// CurrencyInput
// ---------------------------------------------------------------------------
function CurrencyInput({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  const [editing, setEditing] = React.useState(false)
  const [raw, setRaw] = React.useState("")

  return (
    <Input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={editing ? raw : formatCOP(value)}
      onFocus={() => { setEditing(true); setRaw(value > 0 ? String(value) : "") }}
      onBlur={() => { setEditing(false); onChange(parseCOP(raw) || value) }}
      onChange={(e) => setRaw(e.target.value)}
    />
  )
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const personaSchema = z.object({
  documento:     z.string().min(1, "Requerido"),
  nombre:        z.string().min(1, "Requerido"),
  cargo:         z.string().optional(),
  salario:       z.number().min(0, "Debe ser positivo"),
  tipo_pago:     z.enum(["salario", "turno", "produccion"]),
  dias_mes:      z.number().int().min(1).max(31),
  horas_dia:     z.number().min(0.5).max(24),
  fecha_ingreso: z.string().optional(),
  estado:        z.enum(["activo", "inactivo"]),
})
type PersonaForm = z.infer<typeof personaSchema>

const TIPO_PAGO_LABEL: Record<string, string> = {
  salario:    "Salario",
  turno:      "Turno",
  produccion: "Producción",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function PersonalClient({
  personas,
}: {
  personas: PersonaRow[]
  sessionUserId: number
}) {
  const { toast } = useToast()
  const [lista, setLista] = React.useState(personas)
  const [busqueda, setBusqueda] = React.useState("")
  const [filtroTipo, setFiltroTipo] = React.useState("todos")
  const [filtroEstado, setFiltroEstado] = React.useState("todos")
  const [abrirDialog, setAbrirDialog] = React.useState(false)
  const [editando, setEditando] = React.useState<PersonaRow | null>(null)
  const [eliminando, setEliminando] = React.useState<PersonaRow | null>(null)
  const [pending, setPending] = React.useState(false)
  const [cedulaFile, setCedulaFile] = React.useState<File | null>(null)
  const [contratoFile, setContratoFile] = React.useState<File | null>(null)

  React.useEffect(() => { setLista(personas) }, [personas])

  // Filtrado client-side
  const filtradas = lista.filter((p) => {
    const b = busqueda.toLowerCase()
    const matchBusqueda = !b || p.documento.toLowerCase().includes(b) || p.nombre.toLowerCase().includes(b)
    const matchTipo = filtroTipo === "todos" || p.tipo_pago === filtroTipo
    const matchEstado = filtroEstado === "todos" || p.estado === filtroEstado
    return matchBusqueda && matchTipo && matchEstado
  })

  // ---- Form ----
  const form = useForm<PersonaForm>({
    resolver: zodResolver(personaSchema),
    defaultValues: {
      documento: "", nombre: "", cargo: "", salario: 0,
      tipo_pago: "salario", dias_mes: 30, horas_dia: 8,
      fecha_ingreso: "", estado: "activo",
    },
  })

  const salario = form.watch("salario")
  const diasMes = form.watch("dias_mes")
  const horasDia = form.watch("horas_dia")
  const valorHoraCalc = diasMes > 0 && horasDia > 0 && salario > 0
    ? salario / (diasMes * horasDia)
    : null

  function abrirCrear() {
    form.reset({ documento: "", nombre: "", cargo: "", salario: 0, tipo_pago: "salario", dias_mes: 30, horas_dia: 8, fecha_ingreso: "", estado: "activo" })
    setCedulaFile(null); setContratoFile(null)
    setEditando(null); setAbrirDialog(true)
  }

  function abrirEditar(p: PersonaRow) {
    form.reset({
      documento: p.documento, nombre: p.nombre, cargo: p.cargo ?? "",
      salario: p.salario, tipo_pago: p.tipo_pago, dias_mes: p.dias_mes,
      horas_dia: p.horas_dia, fecha_ingreso: p.fecha_ingreso ?? "",
      estado: p.estado,
    })
    setCedulaFile(null); setContratoFile(null)
    setEditando(p); setAbrirDialog(true)
  }

  async function onSubmit(values: PersonaForm) {
    setPending(true)
    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => fd.set(k, String(v ?? "")))
    if (cedulaFile) fd.set("cedula", cedulaFile)
    if (contratoFile) fd.set("contrato", contratoFile)

    const res = editando
      ? await editarPersonaAction(editando.id, fd)
      : await crearPersonaAction(fd)

    setPending(false)
    if (res.error) { toast({ title: "Error", description: res.error, variant: "destructive" }); return }
    toast({ title: editando ? "Persona actualizada" : "Persona creada" })
    setAbrirDialog(false)
  }

  async function confirmarEliminar() {
    if (!eliminando) return
    setPending(true)
    const res = await eliminarPersonaAction(eliminando.id)
    setPending(false)
    if (res.error) toast({ title: "Error", description: res.error, variant: "destructive" })
    else toast({ title: "Persona eliminada" })
    setEliminando(null)
  }

  return (
    <>
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <Input
            placeholder="Buscar por nombre o documento..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo de pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            <SelectItem value="salario">Salario</SelectItem>
            <SelectItem value="turno">Turno</SelectItem>
            <SelectItem value="produccion">Producción</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="activo">Activo</SelectItem>
            <SelectItem value="inactivo">Inactivo</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button onClick={abrirCrear} style={{ backgroundColor: "#344966" }} className="text-white hover:opacity-90">
            <Plus className="h-4 w-4 mr-2" />
            Nueva persona
          </Button>
        </div>
      </div>

      <p className="text-sm text-stone-500">{filtradas.length} registro{filtradas.length !== 1 ? "s" : ""}</p>

      {/* Tabla */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-stone-50">
                <TableHead>Documento</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Tipo pago</TableHead>
                <TableHead className="text-right">Salario</TableHead>
                <TableHead className="text-right">Valor/hora</TableHead>
                <TableHead>Ingreso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Docs</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-stone-400">
                    No hay registros
                  </TableCell>
                </TableRow>
              )}
              {filtradas.map((p) => (
                <TableRow key={p.id} className="hover:bg-stone-50/50 text-sm">
                  <TableCell className="font-mono">{p.documento}</TableCell>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell className="text-stone-500">{p.cargo ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{TIPO_PAGO_LABEL[p.tipo_pago]}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCOP(p.salario)}</TableCell>
                  <TableCell className="text-right font-mono text-stone-500">{formatCOP(p.valor_hora)}</TableCell>
                  <TableCell>{p.fecha_ingreso ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={p.estado === "activo" ? "default" : "secondary"}
                      className={p.estado === "activo" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}
                    >
                      {p.estado === "activo" ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {p.url_cedula && (
                        <a href={p.url_cedula} target="_blank" rel="noreferrer" title="Cédula">
                          <FileText className="h-4 w-4 text-stone-400 hover:text-stone-700" />
                        </a>
                      )}
                      {p.url_contrato && (
                        <a href={p.url_contrato} target="_blank" rel="noreferrer" title="Contrato">
                          <ExternalLink className="h-4 w-4 text-stone-400 hover:text-stone-700" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => abrirEditar(p)} title="Editar">
                        <Pencil className="h-4 w-4 text-stone-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEliminando(p)} title="Eliminar">
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ---- Dialog: Crear/Editar ---- */}
      <Dialog open={abrirDialog} onOpenChange={(v) => { if (!v) setAbrirDialog(false) }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? `Editar — ${editando.nombre}` : "Nueva persona"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="documento" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Documento *</FormLabel>
                    <FormControl><Input placeholder="CC / NIT" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="nombre" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre completo *</FormLabel>
                    <FormControl><Input placeholder="Nombre y apellidos" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="cargo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo</FormLabel>
                    <FormControl><Input placeholder="Ej: Operario de corte" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="tipo_pago" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de pago *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="salario">Salario</SelectItem>
                        <SelectItem value="turno">Turno</SelectItem>
                        <SelectItem value="produccion">Producción</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="salario" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salario (COP) *</FormLabel>
                    <FormControl>
                      <Controller
                        control={form.control}
                        name="salario"
                        render={({ field: f }) => (
                          <CurrencyInput value={f.value} onChange={f.onChange} />
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="dias_mes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Días / mes *</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={31} {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="horas_dia" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horas / día *</FormLabel>
                    <FormControl>
                      <Input type="number" min={0.5} max={24} step={0.5} {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Valor hora calculado */}
              <div className="rounded-xl bg-stone-50 border border-stone-200 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-stone-600 font-medium">Valor / hora (calculado)</span>
                <span className="font-mono font-semibold text-sm" style={{ color: "#344966" }}>
                  {formatCOP(valorHoraCalc)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="fecha_ingreso" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de ingreso</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="estado" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="inactivo">Inactivo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Upload documentos */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Cédula {editando?.url_cedula && <a href={editando.url_cedula} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">(ver actual)</a>}</Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setCedulaFile(e.target.files?.[0] ?? null)}
                  />
                  {cedulaFile && <p className="text-xs text-stone-500">{cedulaFile.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Contrato {editando?.url_contrato && <a href={editando.url_contrato} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">(ver actual)</a>}</Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setContratoFile(e.target.files?.[0] ?? null)}
                  />
                  {contratoFile && <p className="text-xs text-stone-500">{contratoFile.name}</p>}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAbrirDialog(false)}>Cancelar</Button>
                <Button type="submit" disabled={pending} style={{ backgroundColor: "#344966" }} className="text-white hover:opacity-90">
                  {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editando ? "Guardar cambios" : "Crear persona"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ---- AlertDialog: Eliminar ---- */}
      <AlertDialog open={!!eliminando} onOpenChange={(v) => { if (!v) setEliminando(null) }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar persona?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente a <strong>{eliminando?.nombre}</strong>. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEliminar} className="bg-red-600 hover:bg-red-700 text-white">
              {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
