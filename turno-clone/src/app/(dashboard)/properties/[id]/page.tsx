"use client"
import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Card, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input, Textarea } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { motion } from "framer-motion"
import {
  Building2, MapPin, Bed, Bath, Clock, Link2, Plus, Trash2,
  GripVertical, Save, ArrowLeft, Wifi, WifiOff, ChevronDown, ChevronUp, DollarSign
} from "lucide-react"
import Link from "next/link"
import type { Property, ChecklistTemplateItem } from "@/types"

type Room = { name: string; items: { id?: string; label: string }[] }

function groupByRoom(items: ChecklistTemplateItem[]): Room[] {
  const map = new Map<string, { id?: string; label: string }[]>()
  for (const item of items) {
    const room = item.room || "General"
    if (!map.has(room)) map.set(room, [])
    map.get(room)!.push({ id: item.id, label: item.label })
  }
  return Array.from(map.entries()).map(([name, items]) => ({ name, items }))
}

function flattenRooms(rooms: Room[]): { label: string; room: string }[] {
  return rooms.flatMap((r) => r.items.map((i) => ({ label: i.label, room: r.name })))
}

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")
  const [rooms, setRooms] = useState<Room[]>([])
  const [newRoomName, setNewRoomName] = useState("")
  const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(new Set())

  // Edit property fields
  const [editForm, setEditForm] = useState({ airbnbIcalUrl: "", vrboIcalUrl: "", cleaningDuration: "", cleaningFee: "", accessInstructions: "" })
  const [editingSettings, setEditingSettings] = useState(false)

  useEffect(() => {
    fetch(`/api/properties`)
      .then((r) => r.json())
      .then((d) => {
        const prop = d.properties?.find((p: Property) => p.id === id)
        if (!prop) { router.push("/properties"); return }
        setProperty(prop)
        setEditForm({
          airbnbIcalUrl: prop.airbnbIcalUrl || "",
          vrboIcalUrl: prop.vrboIcalUrl || "",
          cleaningDuration: String(prop.cleaningDuration),
          cleaningFee: String(prop.cleaningFee ?? 0),
          accessInstructions: prop.accessInstructions || "",
        })
        const template = prop.checklistTemplate
        if (template?.items?.length) {
          setRooms(groupByRoom(template.items))
        }
      })
      .catch(() => router.push("/properties"))
      .finally(() => setLoading(false))
  }, [id, router])

  const saveChecklist = async () => {
    setSaving(true)
    setSaveMsg("")
    try {
      const items = flattenRooms(rooms)
      const res = await fetch(`/api/properties/${id}/checklist`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      if (res.ok) setSaveMsg("Checklist saved!")
      else setSaveMsg("Save failed")
    } catch {
      setSaveMsg("Save failed")
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(""), 3000)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        const d = await res.json()
        setProperty(d.property)
        setEditingSettings(false)
        setSaveMsg("Settings saved!")
      }
    } catch {}
    setSaving(false)
    setTimeout(() => setSaveMsg(""), 3000)
  }

  const addRoom = () => {
    if (!newRoomName.trim()) return
    setRooms((r) => [...r, { name: newRoomName.trim(), items: [] }])
    setNewRoomName("")
  }

  const addItem = (roomIdx: number) => {
    setRooms((r) => {
      const updated = [...r]
      updated[roomIdx] = { ...updated[roomIdx], items: [...updated[roomIdx].items, { label: "" }] }
      return updated
    })
  }

  const updateItem = (roomIdx: number, itemIdx: number, label: string) => {
    setRooms((r) => {
      const updated = [...r]
      const items = [...updated[roomIdx].items]
      items[itemIdx] = { ...items[itemIdx], label }
      updated[roomIdx] = { ...updated[roomIdx], items }
      return updated
    })
  }

  const removeItem = (roomIdx: number, itemIdx: number) => {
    setRooms((r) => {
      const updated = [...r]
      const items = updated[roomIdx].items.filter((_, i) => i !== itemIdx)
      updated[roomIdx] = { ...updated[roomIdx], items }
      return updated
    })
  }

  const removeRoom = (roomIdx: number) => {
    setRooms((r) => r.filter((_, i) => i !== roomIdx))
  }

  const toggleRoom = (name: string) => {
    setCollapsedRooms((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>
  )
  if (!property) return null

  const hasIcal = property.airbnbIcalUrl || property.vrboIcalUrl

  return (
    <div className="min-h-screen">
      <Header
        title={property.name}
        subtitle={`${property.city}, ${property.state} · ${property.bedrooms} bed / ${property.bathrooms} bath`}
        actions={
          <Link href="/properties">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
        }
      />

      {saveMsg && (
        <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          {saveMsg}
        </div>
      )}

      <div className="p-6 max-w-3xl space-y-6">
        {/* Property overview */}
        <Card>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">{property.name}</h2>
                <div className="flex items-center gap-1 text-slate-500 text-sm">
                  <MapPin className="w-3.5 h-3.5" />
                  {property.address}, {property.city}, {property.state}
                </div>
              </div>
            </div>
            <button onClick={() => setEditingSettings(!editingSettings)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              {editingSettings ? "Cancel" : "Edit Settings"}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Bed className="w-4 h-4 text-slate-400" />
              {property.bedrooms} bedrooms
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Bath className="w-4 h-4 text-slate-400" />
              {property.bathrooms} bathrooms
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="w-4 h-4 text-slate-400" />
              {property.cleaningDuration} min clean
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            {property.airbnbIcalUrl ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-medium rounded-full">
                <Wifi className="w-3 h-3" /> Airbnb iCal
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-medium rounded-full">
                <WifiOff className="w-3 h-3" /> No Airbnb iCal
              </span>
            )}
            {property.vrboIcalUrl ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                <Wifi className="w-3 h-3" /> VRBO iCal
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-medium rounded-full">
                <WifiOff className="w-3 h-3" /> No VRBO iCal
              </span>
            )}
          </div>

          {editingSettings && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-5 pt-5 border-t border-slate-100 space-y-4">
              <Input label="Airbnb iCal URL" icon={Link2}
                placeholder="https://www.airbnb.com/calendar/ical/..."
                value={editForm.airbnbIcalUrl}
                onChange={(e) => setEditForm((f) => ({ ...f, airbnbIcalUrl: e.target.value }))} />
              <Input label="VRBO iCal URL" icon={Link2}
                placeholder="https://www.vrbo.com/calendar/ical/..."
                value={editForm.vrboIcalUrl}
                onChange={(e) => setEditForm((f) => ({ ...f, vrboIcalUrl: e.target.value }))} />
              <Input label="Cleaning duration (minutes)" type="number" icon={Clock}
                value={editForm.cleaningDuration}
                onChange={(e) => setEditForm((f) => ({ ...f, cleaningDuration: e.target.value }))} />
              <Input label="Cleaning Fee ($)" type="number" icon={DollarSign}
                placeholder="0.00"
                value={editForm.cleaningFee}
                min="0"
                step="0.01"
                onChange={(e) => setEditForm((f) => ({ ...f, cleaningFee: e.target.value }))} />
              <Textarea
                label="Entry / Access Instructions"
                placeholder="e.g. Key lockbox code is 1234, located on front gate. Ring doorbell on arrival."
                rows={3}
                value={editForm.accessInstructions}
                onChange={(e) => setEditForm((f) => ({ ...f, accessInstructions: e.target.value }))}
              />
              <Button onClick={saveSettings} loading={saving} size="sm">
                <Save className="w-4 h-4" /> Save Settings
              </Button>
            </motion.div>
          )}
        </Card>

        {/* Checklist Template Editor */}
        <Card padding="none">
          <CardHeader className="p-5 pb-0">
            <CardTitle>Checklist Template</CardTitle>
            <p className="text-sm text-slate-500 mt-0.5">This template is used when creating new jobs for this property.</p>
          </CardHeader>

          <div className="p-5 space-y-4">
            {rooms.map((room, roomIdx) => (
              <div key={room.name + roomIdx} className="border border-slate-200 rounded-2xl overflow-hidden">
                {/* Room header */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <button
                    type="button"
                    onClick={() => toggleRoom(room.name)}
                    className="flex items-center gap-2 font-semibold text-slate-800 text-sm"
                  >
                    {collapsedRooms.has(room.name)
                      ? <ChevronDown className="w-4 h-4 text-slate-400" />
                      : <ChevronUp className="w-4 h-4 text-slate-400" />}
                    {room.name}
                    <span className="text-xs font-normal text-slate-400">({room.items.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRoom(roomIdx)}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {!collapsedRooms.has(room.name) && (
                  <div className="p-3 space-y-2">
                    {room.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => updateItem(roomIdx, itemIdx, e.target.value)}
                          placeholder="Checklist item..."
                          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(roomIdx, itemIdx)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addItem(roomIdx)}
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mt-1 px-2"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add item
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Add new room */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRoom())}
                placeholder="New room name (e.g. Living Room)"
                className="flex-1 px-3 py-2.5 text-sm border border-dashed border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Button type="button" variant="outline" size="sm" onClick={addRoom}>
                <Plus className="w-4 h-4" /> Add Room
              </Button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                {rooms.reduce((a, r) => a + r.items.length, 0)} items across {rooms.length} rooms
              </p>
              <Button onClick={saveChecklist} loading={saving} size="sm">
                <Save className="w-4 h-4" /> Save Checklist
              </Button>
            </div>
          </div>
        </Card>

        {/* Recent jobs for this property */}
        <div className="flex justify-end">
          <Link href={`/jobs?propertyId=${id}`}>
            <Button variant="outline" size="sm">View Jobs for This Property</Button>
          </Link>
          <Link href="/bookings">
            <Button variant="outline" size="sm">View All Bookings</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
