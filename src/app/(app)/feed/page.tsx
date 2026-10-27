import Link from 'next/link'
import { Composer } from '@/components/feed/Composer'
import { BloodAlert } from '@/components/feed/BloodAlert'
import { FeedList } from '@/components/feed/FeedList'
import { RightRail } from '@/components/feed/RightRail'
import { getViewer } from '@/lib/viewer'
import { POST_SELECT, followingOr, toFeedPost } from '@/lib/queries'
import { distanceKm } from '@/lib/geo'
import type { EmergencyCard, LeaderRow, Opportunity } from '@/lib/types'

export default async function FeedPage({ searchParams }: { searchParams: { tab?: string } }) {
  const { supabase, viewer } = await getViewer()
  const tab = searchParams.tab === 'following' ? 'following' : 'for-you'

  // For you = the global feed (everyone's posts, newest first, like Facebook's Home).
  // Following = my own posts + people I follow + organizations I follow.
  let orFilter: string | null = null
  if (tab === 'following') {
    const [orgs, people] = await Promise.all([
      supabase.from('org_followers').select('org_id').eq('user_id', viewer.id),
      supabase.from('user_follows').select('followee_id').eq('follower_id', viewer.id),
    ])
    orFilter = followingOr(viewer.id, (people.data ?? []).map((r: { followee_id: string }) => r.followee_id), (orgs.data ?? []).map((r: { org_id: string }) => r.org_id))
  }

  let postsQ = supabase.from('posts').select(POST_SELECT)
    .eq('likes.user_id', viewer.id).eq('initiative_joins.user_id', viewer.id)
    .order('created_at', { ascending: false }).limit(10)
  if (orFilter) postsQ = postsQ.or(orFilter)
  const postsQuery = postsQ

  const nowIso = new Date().toISOString()
  const [posts, match, opps, board, events, admin] = await Promise.all([
    postsQuery,
    supabase.from('emergency_matches')
      .select('id, response, request:emergency_requests!inner(id, blood_group, hospital, lat, lng, needed_by, status, expires_at, created_at, note, contact_phone, org:organizations(name))')
      .eq('user_id', viewer.id).eq('request.status', 'active').gt('request.expires_at', nowIso)
      .or('response.is.null,response.eq.accepted')
      .order('notified_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.rpc('matched_opportunities', { p_limit: 1 }),
    supabase.rpc('leaderboard', { p_days: 7, p_below: 0 }),
    supabase.from('events').select('id, title, starts_at').gt('starts_at', nowIso).order('starts_at').limit(20),
    supabase.from('org_members').select('org:organizations(id, name)').eq('user_id', viewer.id).in('role', ['owner', 'admin']).eq('status', 'approved'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = match.data as any
  const card: EmergencyCard | null = m?.request ? {
    matchId: m.id, response: m.response, bloodGroup: m.request.blood_group, hospital: m.request.hospital,
    postedAt: m.request.created_at, neededBy: m.request.needed_by,
    distanceKm: distanceKm(viewer.lat, viewer.lng, m.request.lat, m.request.lng),
    orgName: m.request.org?.name ?? null, note: m.request.note ?? null, contactPhone: m.request.contact_phone ?? null,
  } : null

  const feed = (posts.data ?? []).map(toFeedPost)
  const adminOrgs = ((admin.data ?? []) as unknown as { org: { id: string; name: string } | null }[]).flatMap((r) => (r.org ? [r.org] : []))

  return (
    <div className="home-grid">
      <main className="feed">
        <Composer userId={viewer.id} firstName={viewer.firstName} initials={viewer.initials} events={events.data ?? []} adminOrgs={adminOrgs} />
        <BloodAlert userId={viewer.id} card={card} />
        <div className="feed-heading">
          <div>
            <span className="eyebrow">YOUR COMMUNITY</span>
            <h2>Good things are happening</h2>
          </div>
          <div className="feed-toggle">
            <Link href="/feed" className={tab === 'for-you' ? 'active' : ''}>For you</Link>
            <Link href="/feed?tab=following" className={tab === 'following' ? 'active' : ''}>Following</Link>
          </div>
        </div>
        {posts.error && (
          <p className="form-error" role="alert">Couldn’t load the feed: {posts.error.message}</p>
        )}
        <FeedList initial={feed} viewerId={viewer.id} viewerInitials={viewer.initials} orFilter={orFilter}
          emptyTitle={tab === 'following' ? 'Your following feed is quiet' : undefined}
          emptyHint={tab === 'following' ? 'Follow people and organizations to see their posts here. Your own posts appear here too.' : undefined} />
      </main>
      <RightRail opportunity={((opps.data ?? []) as Opportunity[])[0] ?? null} leaders={((board.data ?? []) as LeaderRow[]).slice(0, 3)} />
    </div>
  )
}
