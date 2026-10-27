import { RewardsView } from '@/components/profile/RewardsView'
import { getViewer } from '@/lib/viewer'
import type { LeaderRow } from '@/lib/types'

export default async function RewardsPage() {
  const { supabase, viewer } = await getViewer()
  const [{ data: w }, { data: streak }, { data: board }, { data: p }] = await Promise.all([
    supabase.from('user_world').select('points, volunteer_hours, good_deeds, blood_donations, invites').eq('user_id', viewer.id).maybeSingle(),
    supabase.rpc('my_streak'),
    supabase.rpc('leaderboard', { p_days: 30, p_below: 1 }),
    supabase.from('profiles').select('location').eq('id', viewer.id).single(),
  ])
  const s = Array.isArray(streak) ? streak[0] : streak
  return (
    <RewardsView
      stats={{ points: w?.points ?? 0, hours: Number(w?.volunteer_hours ?? 0), actions: w?.good_deeds ?? 0, invites: w?.invites ?? 0, bloodDonations: w?.blood_donations ?? 0, streak: s?.current_weeks ?? 0 }}
      longestStreak={s?.longest_weeks ?? 0}
      leaders={(board ?? []) as LeaderRow[]}
      city={(p?.location ?? 'Your area').split(',')[0]}
    />
  )
}
