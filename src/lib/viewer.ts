import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { initials } from '@/lib/format'
import { geocodePlace } from '@/lib/places'
import type { Viewer } from '@/lib/types'

export async function getViewer() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: world }, { count: unread }, { data: health }] = await Promise.all([
    supabase.from('profiles').select('full_name, skills, lat, lng, location').eq('id', user.id).single(),
    supabase.from('user_world').select('points').eq('user_id', user.id).maybeSingle(),
    supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('kind', 'hub').is('read_at', null),
    supabase.from('profile_health').select('blood_group').eq('user_id', user.id).maybeSingle(),
  ])
  const fallback = profile?.lat == null ? geocodePlace(profile?.location) : null

  const fullName = profile?.full_name ?? user.email ?? 'You'
  const viewer: Viewer = {
    id: user.id,
    fullName,
    firstName: fullName.split(' ')[0],
    initials: initials(fullName),
    skills: profile?.skills ?? [],
    lat: profile?.lat ?? fallback?.lat ?? null,
    lng: profile?.lng ?? fallback?.lng ?? null,
    location: profile?.location ?? '',
    points: world?.points ?? 0,
    // The prompt disappears the moment the basics are filled in.
    profileGap: (profile?.skills ?? []).length === 0 ? 'Add a skill so we can match you with the right opportunities.'
      : !health?.blood_group ? 'Add your blood group to receive urgent requests near you.'
      : !profile?.location ? 'Add your location to see opportunities near you.'
      : null,
  }
  return { supabase, viewer, hubBadge: unread ?? 0 }
}
