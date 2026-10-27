import { notFound, redirect } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { FeedList } from '@/components/feed/FeedList'
import { FollowButton } from '@/components/profile/FollowButton'
import { getViewer } from '@/lib/viewer'
import { POST_SELECT, toFeedPost } from '@/lib/queries'
import { initials, fmt } from '@/lib/format'

export default async function PersonPage({ params }: { params: { id: string } }) {
  const { supabase, viewer } = await getViewer()
  if (params.id === viewer.id) redirect('/profile')

  const { data: p } = await supabase.from('profiles')
    .select('id, full_name, location, headline, bio, skills, identity_verified, avatar_url, banner_url').eq('id', params.id).maybeSingle()
  if (!p) notFound()
  const [{ data: w }, posts, followers, following, iFollow] = await Promise.all([
    supabase.from('user_world').select('points, volunteer_hours, good_deeds').eq('user_id', p.id).maybeSingle(),
    supabase.from('posts').select(POST_SELECT).eq('author_id', p.id).is('org_id', null)
      .eq('likes.user_id', viewer.id).eq('initiative_joins.user_id', viewer.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('user_follows').select('follower_id', { count: 'exact', head: true }).eq('followee_id', p.id),
    supabase.from('user_follows').select('followee_id', { count: 'exact', head: true }).eq('follower_id', p.id),
    supabase.from('user_follows').select('follower_id').eq('follower_id', viewer.id).eq('followee_id', p.id).maybeSingle(),
  ])
  const first = (p.full_name ?? 'Member').split(' ')[0]

  return (
    <main className="page profile-page">
      <section className="personal-header">
        <div className={`personal-cover${p.banner_url ? ' has-image' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.banner_url && <img className="cover-img" src={p.banner_url} alt="" />}
        </div>
        <div className="personal-main">
          <span className="profile-avatar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.avatar_url ? <img className="avatar-img" src={p.avatar_url} alt={p.full_name ?? 'Member'} /> : initials(p.full_name)}
          </span>
          <div>
            <h1>{p.full_name}</h1>
            <p>{[p.headline ?? 'Volunteer', p.location].filter(Boolean).join(' · ')}</p>
            {p.identity_verified && <span className="profile-verified"><Icon name="check" size={14} /> Identity verified</span>}
          </div>
          <FollowButton meId={viewer.id} targetId={p.id} initialFollowing={!!iFollow.data} initialCount={followers.count ?? 0} />
        </div>
      </section>

      <div className="profile-layout">
        <section className="content-card">
          <span className="eyebrow">CIVIC PROFILE</span>
          <h2>About {first}</h2>
          <p className="muted-copy">{p.bio ?? `${first} hasn’t added a bio yet.`}</p>
          <div className="profile-facts">
            {p.location && <div><Icon name="pin" /><span><b>{p.location}</b></span></div>}
            {(p.skills ?? []).length > 0 && <div><Icon name="spark" /><span><b>{(p.skills as string[]).join(', ')}</b><small>Skills shared with organizations</small></span></div>}
          </div>
        </section>
        <section className="content-card profile-score">
          <span className="eyebrow">VERIFIED IMPACT</span>
          <strong>{fmt(w?.points ?? 0)}</strong>
          <span>Civic points</span>
          <div>
            <b>{Number(w?.volunteer_hours ?? 0)}</b><small>Hours given</small>
            <b>{w?.good_deeds ?? 0}</b><small>Good deeds</small>
            <b>{following.count ?? 0}</b><small>Following</small>
          </div>
        </section>
      </div>

      <section style={{ marginTop: 24, maxWidth: 760 }}>
        <div className="feed-heading"><div><span className="eyebrow">TIMELINE</span><h2>Posts by {first}</h2></div></div>
        {posts.error && <p className="form-error" role="alert">Couldn’t load posts: {posts.error.message}</p>}
        <FeedList initial={(posts.data ?? []).map(toFeedPost)} viewerId={viewer.id} viewerInitials={viewer.initials}
          authorId={p.id} personalOnly emptyTitle={`${first} hasn’t posted yet`} emptyHint="Their updates will appear here." />
      </section>
    </main>
  )
}
