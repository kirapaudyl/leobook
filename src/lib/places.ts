// Kathmandu Valley + major Nepal cities. Used to place members on the map when they type a city
// instead of sharing GPS, and to power the location autocomplete.
export const NEPAL_PLACES: { name: string; lat: number; lng: number }[] = [
  { name: 'Kathmandu', lat: 27.7172, lng: 85.3240 },
  { name: 'Lalitpur', lat: 27.6644, lng: 85.3188 },
  { name: 'Patan', lat: 27.6727, lng: 85.3250 },
  { name: 'Bhaktapur', lat: 27.6710, lng: 85.4298 },
  { name: 'Kirtipur', lat: 27.6788, lng: 85.2778 },
  { name: 'Budhanilkantha', lat: 27.7770, lng: 85.3626 },
  { name: 'Boudha', lat: 27.7215, lng: 85.3620 },
  { name: 'Thamel', lat: 27.7154, lng: 85.3123 },
  { name: 'Baneshwor', lat: 27.6915, lng: 85.3420 },
  { name: 'Koteshwor', lat: 27.6770, lng: 85.3490 },
  { name: 'Maharajgunj', lat: 27.7360, lng: 85.3303 },
  { name: 'Balaju', lat: 27.7350, lng: 85.3050 },
  { name: 'Kalanki', lat: 27.6930, lng: 85.2810 },
  { name: 'Pokhara', lat: 28.2096, lng: 83.9856 },
  { name: 'Chitwan', lat: 27.5291, lng: 84.3542 },
  { name: 'Bharatpur', lat: 27.6833, lng: 84.4333 },
  { name: 'Biratnagar', lat: 26.4525, lng: 87.2718 },
  { name: 'Butwal', lat: 27.7006, lng: 83.4483 },
]

export const KATHMANDU = { lat: 27.7172, lng: 85.3240 }

export function geocodePlace(text?: string | null): { lat: number; lng: number } | null {
  const t = (text ?? '').toLowerCase()
  if (!t.trim()) return null
  const hit = NEPAL_PLACES.find((p) => t.includes(p.name.toLowerCase()))
  return hit ? { lat: hit.lat, lng: hit.lng } : null
}
