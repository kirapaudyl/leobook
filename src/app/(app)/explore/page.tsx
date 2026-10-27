import { ExploreView, type ExploreEvent } from '@/components/explore/ExploreView'
import { getViewer } from '@/lib/viewer'
import { distanceKm } from '@/lib/geo'
import { KATHMANDU } from '@/lib/places'

const RADIUS_KM = 150

export default async function ExplorePage({ searchParams }: { searchParams: { event?: string } }) {
  const { supabase, viewer } = await getViewer()
  const { data } = await supabase.from('events')
    .select('id, title, description, cause, starts_at, location, lat, lng, points, skills_wanted, event_rsvps(user_id)')
    .gt('starts_at', new Date().toISOString()).order('starts_at').limit(60)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events: ExploreEvent[] = (data ?? []).map((e: any) => ({
    id: e.id, title: e.title, description: e.description, cause: e.cause ?? 'Community', starts_at: e.starts_at,
    location: e.location, lat: e.lat, lng: e.lng, points: e.points, skills: e.skills_wanted ?? [],
    distanceKm: distanceKm(viewer.lat, viewer.lng, e.lat, e.lng),
    going: (e.event_rsvps ?? []).length,
    registered: (e.event_rsvps ?? []).some((r: { user_id: string }) => r.user_id === viewer.id),
  }))
  // Only show what's actually near the member (default: Kathmandu). Far-away demo data is dropped.
  const center = viewer.lat != null && viewer.lng != null ? { lat: viewer.lat, lng: viewer.lng } : KATHMANDU
  const nearby = events.filter((e) => (distanceKm(center.lat, center.lng, e.lat, e.lng) ?? 0) <= RADIUS_KM)
  nearby.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) || +new Date(a.starts_at) - +new Date(b.starts_at))

  const { data: orgRows } = await supabase.from('organizations').select('id, slug, name, type, location, lat, lng, verified').limit(60)
  const orgs = (orgRows ?? []).map((o) => ({ ...o, km: distanceKm(center.lat, center.lng, o.lat, o.lng) }))
    .filter((o) => (o.km ?? 0) <= RADIUS_KM).sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9)).slice(0, 6)

  return <ExploreView events={nearby} userId={viewer.id} location={viewer.location} initialId={searchParams.event}
    center={center} me={viewer.lat != null && viewer.lng != null ? { lat: viewer.lat, lng: viewer.lng } : null} orgs={orgs} />
}
