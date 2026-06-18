"use client"

import * as React from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Pencil, Trash2, ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
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
import { crearUsuarioAction, editarUsuarioAction, eliminarUsuarioAction } from "@/app/(dashboard)/usuarios/actions"
import type { UsuarioConPersona } from "@/lib/db/usuario"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const crearSchema = z.object({
  nombre_usuario: z.string().min(3, "Mínimo 3 caracteres").max(50),
  nombre_completo: z.string().min(1, "Requerido"),
  contrasena: z.string().min(6, "Mínimo 6 caracteres"),
  activo: z.boolean(),
})

const editarSchema = z.object({
  nombre_completo: z.string().min(1, "Requerido"),
  contrasena: z.string().min(6, "Mínimo 6 caracteres").optional().or(z.literal("")),
  activo: z.boolean(),
})

type CrearForm = z.infer<typeof crearSchema>
type EditarForm = z.infer<typeof editarSchema>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function UsuariosClient({
  usuarios,
  sessionUserId,
}: {
  usuarios: UsuarioConPersona[]
  sessionUserId: number
}) {
  const { toast } = useToast()
  const [lista, setLista] = React.useState(usuarios)
  const [abrirCrear, setAbrirCrear] = React.useState(false)
  const [editando, setEditando] = React.useState<UsuarioConPersona | null>(null)
  const [eliminando, setEliminando] = React.useState<UsuarioConPersona | null>(null)
  const [pending, setPending] = React.useState(false)
  const [showPass, setShowPass] = React.useState(false)

  React.useEffect(() => { setLista(usuarios) }, [usuarios])

  // ---- Formulario Crear ----
  const crearForm = useForm<CrearForm>({
    resolver: zodResolver(crearSchema),
    defaultValues: { nombre_usuario: "", nombre_completo: "", contrasena: "", activo: true },
  })

  async function onCrear(values: CrearForm) {
    setPending(true)
    const fd = new FormData()
    fd.set("nombre_usuario", values.nombre_usuario)
    fd.set("nombre_completo", values.nombre_completo)
    fd.set("contrasena", values.contrasena)
    fd.set("activo", String(values.activo))
    const res = await crearUsuarioAction(fd)
    setPending(false)
    if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" })
      return
    }
    toast({ title: "Usuario creado" })
    setAbrirCrear(false)
    crearForm.reset()
  }

  // ---- Formulario Editar ----
  const editarForm = useForm<EditarForm>({
    resolver: zodResolver(editarSchema),
    defaultValues: { nombre_completo: "", contrasena: "", activo: true },
  })

  React.useEffect(() => {
    if (editando) {
      editarForm.reset({
        nombre_completo: editando.nombre_completo ?? "",
        contrasena: "",
        activo: editando.activo,
      })
    }
  }, [editando, editarForm])

  async function onEditar(values: EditarForm) {
    if (!editando) return
    setPending(true)
    const fd = new FormData()
    fd.set("nombre_completo", values.nombre_completo)
    fd.set("contrasena", values.contrasena ?? "")
    fd.set("activo", String(values.activo))
    const res = await editarUsuarioAction(editando.id, fd)
    setPending(false)
    if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" })
      return
    }
    toast({ title: "Usuario actualizado" })
    setEditando(null)
  }

  // ---- Eliminar ----
  async function confirmarEliminar() {
    if (!eliminando) return
    setPending(true)
    const res = await eliminarUsuarioAction(eliminando.id)
    setPending(false)
    if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" })
    } else {
      toast({ title: "Usuario eliminado" })
    }
    setEliminando(null)
  }

  return (
    <>
      {/* Barra superior */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">{lista.length} usuario{lista.length !== 1 ? "s" : ""}</p>
        <Button
          onClick={() => { crearForm.reset(); setAbrirCrear(true) }}
          style={{ backgroundColor: "#344966" }}
          className="text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo usuario
        </Button>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-stone-50">
              <TableHead>Usuario</TableHead>
              <TableHead>Nombre completo</TableHead>
              <TableHead>Persona vinculada</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-stone-400">
                  No hay usuarios registrados
                </TableCell>
              </TableRow>
            )}
            {lista.map((u) => (
              <TableRow key={u.id} className="hover:bg-stone-50/50">
                <TableCell className="font-mono text-sm">@{u.nombre_usuario}</TableCell>
                <TableCell className="font-medium">{u.nombre_completo ?? "—"}</TableCell>
                <TableCell className="text-sm text-stone-500">
                  {u.persona ? `${u.persona.nombre} · ${u.persona.documento}` : "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={u.activo ? "default" : "secondary"}
                    className={u.activo ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}
                  >
                    {u.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild title="Permisos">
                      <Link href={`/usuarios/${u.id}/permisos`}>
                        <ShieldCheck className="h-4 w-4 text-stone-500" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Editar"
                      onClick={() => setEditando(u)}
                    >
                      <Pencil className="h-4 w-4 text-stone-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Eliminar"
                      disabled={u.id === sessionUserId}
                      onClick={() => setEliminando(u)}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ---- Dialog: Crear ---- */}
      <Dialog open={abrirCrear} onOpenChange={setAbrirCrear}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <Form {...crearForm}>
            <form onSubmit={crearForm.handleSubmit(onCrear)} className="space-y-4">
              <FormField control={crearForm.control} name="nombre_usuario" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de usuario</FormLabel>
                  <FormControl><Input placeholder="ej: jperez" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={crearForm.control} name="nombre_completo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo</FormLabel>
                  <FormControl><Input placeholder="Juan Pérez" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={crearForm.control} name="contrasena" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPass ? "text" : "password"} placeholder="Mínimo 6 caracteres" {...field} />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPass((v) => !v)} tabIndex={-1}>
                        {showPass ? <EyeOff className="h-4 w-4 text-stone-400" /> : <Eye className="h-4 w-4 text-stone-400" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={crearForm.control} name="activo" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <Label className="!mt-0">Usuario activo</Label>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAbrirCrear(false)}>Cancelar</Button>
                <Button type="submit" disabled={pending} style={{ backgroundColor: "#344966" }} className="text-white hover:opacity-90">
                  {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Crear usuario
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ---- Dialog: Editar ---- */}
      <Dialog open={!!editando} onOpenChange={(v) => { if (!v) setEditando(null) }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Editar usuario — @{editando?.nombre_usuario}</DialogTitle>
          </DialogHeader>
          <Form {...editarForm}>
            <form onSubmit={editarForm.handleSubmit(onEditar)} className="space-y-4">
              <FormField control={editarForm.control} name="nombre_completo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editarForm.control} name="contrasena" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nueva contraseña <span className="text-stone-400 font-normal">(dejar vacío para no cambiar)</span></FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPass ? "text" : "password"} placeholder="••••••••" {...field} />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPass((v) => !v)} tabIndex={-1}>
                        {showPass ? <EyeOff className="h-4 w-4 text-stone-400" /> : <Eye className="h-4 w-4 text-stone-400" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editarForm.control} name="activo" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <Label className="!mt-0">Usuario activo</Label>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
                <Button type="submit" disabled={pending} style={{ backgroundColor: "#344966" }} className="text-white hover:opacity-90">
                  {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Guardar cambios
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
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente a <strong>@{eliminando?.nombre_usuario}</strong> y sus permisos. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarEliminar}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
