import { notFound } from 'next/navigation'
import { HubView, type HubOrg } from '@/components/hub/HubView'
import { getViewer } from '@/lib/viewer'
import { POST_SELECT, toFeedPost } from '@/lib/queries'

export default async function HubPage({ params }: { params: { slug: string } }) {
  const { supabase, viewer } = await getViewer()
  const { data: org } = await supabase.from('organizations').select('*').eq('slug', params.slug).maybeSingle()
  if (!org) notFound()

  const [members, mine, follow, events, posts, gallery] = await Promise.all([
    supabase.from('org_members').select('user_id', { count: 'exact', head: true }).eq('org_id', org.id).eq('status', 'approved'),
    supabase.from('org_members').select('role, status').eq('org_id', org.id).eq('user_id', viewer.id).maybeSingle(),
    supabase.from('org_followers').select('user_id').eq('org_id', org.id).eq('user_id', viewer.id).maybeSingle(),
    supabase.from('events').select('id, title, description, format_label, kind, starts_at').eq('org_id', org.id).gt('starts_at', new Date().toISOString()).order('starts_at').limit(12),
    supabase.from('posts').select(POST_SELECT).eq('org_id', org.id).eq('likes.user_id', viewer.id).eq('initiative_joins.user_id', viewer.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('org_gallery').select('id, url, caption').eq('org_id', org.id).order('position').limit(3),
  ])

  const isMember = mine.data?.status === 'approved'
  const isAdmin = isMember && ['owner', 'admin'].includes(mine.data?.role ?? '')
  const membership = isAdmin ? 'admin' : isMember ? 'member' : mine.data?.status === 'pending' ? 'pending' : 'none'

  const [stats, msgs, roster, canBlood] = await Promise.all([
    isAdmin ? supabase.rpc('org_admin_stats', { p_org: org.id }) : Promise.resolve({ data: null }),
    isMember ? supabase.from('org_messages').select('id, author_id, body, created_at, author:profiles(full_name)').eq('org_id', org.id).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    isAdmin ? supabase.from('org_members').select('user:profiles(id, full_name)').eq('org_id', org.id).eq('status', 'approved') : Promise.resolve({ data: [] }),
    isAdmin ? supabase.rpc('can_send_blood_alerts', { p_org: org.id }) : Promise.resolve({ data: false }),
  ])
  const s = Array.isArray(stats.data) ? stats.data[0] : stats.data

  return (
    <HubView
      org={org as HubOrg}
      followers={org.follower_count}
      members={members.count ?? 0}
      following={!!follow.data}
      membership={membership}
      events={events.data ?? []}
      posts={(posts.data ?? []).map(toFeedPost)}
      gallery={gallery.data ?? []}
      stats={s ? { upcoming: s.upcoming_events, hours: Number(s.hours_this_month), volunteers: s.active_volunteers } : null}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages={((msgs.data ?? []) as any[]).reverse().map((m) => ({ id: m.id, author_id: m.author_id, body: m.body, created_at: m.created_at, name: m.author?.full_name ?? 'Member' }))}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      roster={((roster.data ?? []) as any[]).flatMap((r) => (r.user ? [r.user as { id: string; full_name: string | null }] : []))}
      viewer={{ id: viewer.id, firstName: viewer.firstName, initials: viewer.initials }}
      canSendBlood={canBlood.data === true}
    />
  )
}
