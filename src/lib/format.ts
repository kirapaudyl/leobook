export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function minutesAgoLong(iso: string): string {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

export const initials = (name?: string | null) =>
  (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'

const t = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
/** "Sat, May 24 · 9:00 AM" */
export const eventShort = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${t(d)}`
}
/** "May 24 · 9:00 AM" */
export const eventMed = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} · ${t(d)}`
}
/** "Saturday, 9:00 AM" */
export const campaignWhen = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-US', { weekday: 'long' })}, ${t(d)}`
}
export const clockTime = (iso: string) => t(new Date(iso))
export const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
export const fmt = (n: number) => n.toLocaleString('en-US')
