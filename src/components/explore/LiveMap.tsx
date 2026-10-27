'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { KATHMANDU } from '@/lib/places'

interface Pin { id: string; title: string; lat: number | null; lng: number | null }

/** Real OpenStreetMap (Leaflet). Pins are the design's teardrop markers, numbered to match the list. */
export default function LiveMap({ events, selectedId, onSelect, me, center }: {
  events: Pin[]; selectedId?: string; onSelect: (id: string) => void; me: { lat: number; lng: number } | null; center: { lat: number; lng: number }
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { scrollWheelZoom: false, minZoom: 7 }).setView([center.lat || KATHMANDU.lat, center.lng || KATHMANDU.lng], 12)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    // enable wheel zoom only after the user clicks the map (so page scrolling isn't hijacked)
    m.on('click', () => m.scrollWheelZoom.enable())
    return () => { m.remove(); map.current = null; layer.current = null }
  }, [])

  // markers
  useEffect(() => {
    const g = layer.current
    if (!g) return
    g.clearLayers()
    events.forEach((e, i) => {
      if (e.lat == null || e.lng == null) return
      const icon = L.divIcon({ className: `leo-pin ${e.id === selectedId ? 'selected' : ''}`, html: `<span><b>${i + 1}</b></span>`, iconSize: [0, 0] })
      L.marker([e.lat, e.lng], { icon, title: e.title, keyboard: true })
        .on('click', () => onSelectRef.current(e.id)).bindTooltip(e.title, { direction: 'top', offset: [0, -44] }).addTo(g)
    })
    if (me) L.marker([me.lat, me.lng], { icon: L.divIcon({ className: '', html: '<div class="leo-me"></div>', iconSize: [16, 16] }), interactive: false, title: 'You are here' }).addTo(g)
  }, [events, selectedId, me])

  // fit the view when the set of events changes (not on every selection)
  const key = events.map((e) => e.id).join(',')
  useEffect(() => {
    const m = map.current
    if (!m) return
    const pts = events.filter((e) => e.lat != null && e.lng != null).map((e) => [e.lat!, e.lng!] as [number, number])
    if (me) pts.push([me.lat, me.lng])
    if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 13 })
    else if (pts.length === 1) m.setView(pts[0], 13)
    else m.setView([center.lat, center.lng], 12)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    const e = events.find((x) => x.id === selectedId)
    if (e && e.lat != null && e.lng != null) map.current?.panTo([e.lat, e.lng], { animate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  return <div ref={el} className="map-live" role="application" aria-label="Map of nearby volunteering opportunities" />
}
