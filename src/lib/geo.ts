export function distanceKm(aLat?: number | null, aLng?: number | null, bLat?: number | null, bLng?: number | null) {
  if ([aLat, aLng, bLat, bLng].some((v) => v == null)) return null
  const r = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(r(bLat! - aLat!) / 2) ** 2 +
    Math.cos(r(aLat!)) * Math.cos(r(bLat!)) * Math.sin(r(bLng! - aLng!) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
export const formatKm = (km: number) => `${km.toFixed(1)} km`
