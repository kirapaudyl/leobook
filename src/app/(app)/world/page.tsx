import { WorldView } from '@/components/world/WorldView'
import { getViewer } from '@/lib/viewer'
import type { Deed } from '@/lib/world'

export default async function WorldPage() {
  const { supabase, viewer } = await getViewer()
  const [{ data }, { data: w }, { count: events }] = await Promise.all([
    supabase.from('good_deeds').select('id, kind, title, hours, quantity, points, verified_at')
      .eq('user_id', viewer.id).eq('status', 'verified').order('verified_at', { ascending: false }).limit(20),
    supabase.from('user_world').select('points, volunteer_hours, blood_donations, invites').eq('user_id', viewer.id).maybeSingle(),
    supabase.from('good_deeds').select('id', { count: 'exact', head: true }).eq('user_id', viewer.id).eq('status', 'verified').eq('kind', 'event'),
  ])
  return (
    <WorldView userId={viewer.id} points={viewer.points} deeds={(data ?? []) as Deed[]}
      stats={{ hours: Number(w?.volunteer_hours ?? 0), invites: w?.invites ?? 0, events: events ?? 0, blood: w?.blood_donations ?? 0 }} />
  )
}
