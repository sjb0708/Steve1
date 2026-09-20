"use client"
import { useEffect, useMemo, useRef } from "react"
import { MapContainer, TileLayer, Circle, CircleMarker, Marker, Tooltip, useMap, useMapEvents } from "react-leaflet"
import L from "leaflet"
// Ships with the map chunk, so it only loads on this page
import "leaflet/dist/leaflet.css"

export interface MapHome {
  id: string
  address: string
  latitude: number
  longitude: number
  price: number
  cashFlow: number | null
  meetsGoals: boolean
}

interface Props {
  center: { lat: number; lng: number }
  radiusMiles: number
  homes: MapHome[]
  selectedId: string | null
  onSelectHome: (id: string | null) => void
  onChangeArea: (area: { centerLat?: number; centerLng?: number; radiusMiles?: number }) => void
}

const MILES_TO_METERS = 1609.34

// Plain HTML markers — no image files to load or break
function handleIcon(kind: "center" | "edge") {
  const style =
    kind === "center"
      ? "width:18px;height:18px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:move"
      : "width:14px;height:14px;border-radius:9999px;background:#fff;border:3px solid #2563eb;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:ew-resize"
  return L.divIcon({ className: "", html: `<div style="${style}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] })
}

function milesToLngDegrees(miles: number, lat: number) {
  return miles / (69 * Math.cos((lat * Math.PI) / 180))
}

// Keeps the whole circle in view when the area changes from the inputs
function FitToArea({ center, radiusMiles, skipRef }: { center: { lat: number; lng: number }; radiusMiles: number; skipRef: React.RefObject<boolean> }) {
  const map = useMap()
  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false
      return
    }
    const dLat = radiusMiles / 69
    const dLng = milesToLngDegrees(radiusMiles, center.lat)
    map.fitBounds(
      [
        [center.lat - dLat, center.lng - dLng],
        [center.lat + dLat, center.lng + dLng],
      ],
      { padding: [20, 20] },
    )
  }, [map, center.lat, center.lng, radiusMiles, skipRef])
  return null
}

function ClickToMove({ onChangeArea, skipRef }: { onChangeArea: Props["onChangeArea"]; skipRef: React.RefObject<boolean> }) {
  useMapEvents({
    click(e) {
      skipRef.current = true
      onChangeArea({ centerLat: Number(e.latlng.lat.toFixed(5)), centerLng: Number(e.latlng.lng.toFixed(5)) })
    },
  })
  return null
}

export default function AreaMap({ center, radiusMiles, homes, selectedId, onSelectHome, onChangeArea }: Props) {
  const skipFit = useRef(false)
  const edge = useMemo(
    () => ({ lat: center.lat, lng: center.lng + milesToLngDegrees(radiusMiles, center.lat) }),
    [center.lat, center.lng, radiusMiles],
  )

  return (
    <div className="h-[420px] rounded-2xl overflow-hidden border border-slate-200">
      <MapContainer center={[center.lat, center.lng]} zoom={11} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FitToArea center={center} radiusMiles={radiusMiles} skipRef={skipFit} />
        <ClickToMove onChangeArea={onChangeArea} skipRef={skipFit} />

        <Circle
          center={[center.lat, center.lng]}
          radius={radiusMiles * MILES_TO_METERS}
          pathOptions={{ color: "#2563eb", weight: 2, fillColor: "#2563eb", fillOpacity: 0.07 }}
        />

        {homes.map((h) => {
          const selected = h.id === selectedId
          return (
            <CircleMarker
              key={h.id}
              center={[h.latitude, h.longitude]}
              radius={selected ? 9 : 6}
              pathOptions={{
                color: "#fff",
                weight: 2,
                fillColor: selected ? "#eb6834" : h.meetsGoals ? "#1baf7a" : "#64748b",
                fillOpacity: 1,
              }}
              eventHandlers={{ click: () => onSelectHome(selected ? null : h.id) }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                <span className="text-xs">
                  <b>${Math.round(h.price).toLocaleString()}</b> · {h.address}
                  {h.cashFlow !== null && (
                    <>
                      <br />
                      {h.cashFlow >= 0 ? "+" : "-"}${Math.abs(Math.round(h.cashFlow)).toLocaleString()}/yr cash flow
                    </>
                  )}
                </span>
              </Tooltip>
            </CircleMarker>
          )
        })}

        <Marker
          position={[center.lat, center.lng]}
          icon={handleIcon("center")}
          draggable
          eventHandlers={{
            dragend(e) {
              const { lat, lng } = (e.target as L.Marker).getLatLng()
              skipFit.current = true
              onChangeArea({ centerLat: Number(lat.toFixed(5)), centerLng: Number(lng.toFixed(5)) })
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -10]}>Drag to move the search area, or click anywhere on the map</Tooltip>
        </Marker>

        <Marker
          position={[edge.lat, edge.lng]}
          icon={handleIcon("edge")}
          draggable
          eventHandlers={{
            dragend(e) {
              const pos = (e.target as L.Marker).getLatLng()
              const meters = L.latLng(center.lat, center.lng).distanceTo(pos)
              skipFit.current = true
              onChangeArea({ radiusMiles: Math.min(40, Math.max(1, Number((meters / MILES_TO_METERS).toFixed(1)))) })
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -10]}>Drag to change the radius ({radiusMiles} miles)</Tooltip>
        </Marker>
      </MapContainer>
    </div>
  )
}
