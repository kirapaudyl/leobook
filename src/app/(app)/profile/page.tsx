import { Icon } from '@/components/Icon'
import { Composer } from '@/components/feed/Composer'
import { FeedList } from '@/components/feed/FeedList'
import { POST_SELECT, toFeedPost } from '@/lib/queries'
import { ProfileActions } from '@/components/profile/ProfileActions'
import { ProfileBanner, ProfileAvatar } from '@/components/profile/ProfileMedia'
import { getViewer } from '@/lib/viewer'
import { fmt } from '@/lib/format'

export default async function ProfilePage({ searchParams }: { searchParams: { setup?: string } }) {
  const { supabase, viewer } = await getViewer()
  const [{ data: p }, { data: h }, { data: w }, posts, events, followers, following] = await Promise.all([
    supabase.from('profiles').select('interests, headline, bio, identity_verified, location, lat, skills, avatar_url, banner_url').eq('id', viewer.id).single(),
    supabase.from('profile_health').select('blood_group, is_blood_donor').eq('user_id', viewer.id).maybeSingle(),
    supabase.from('user_world').select('points, volunteer_hours, good_deeds, blood_donations').eq('user_id', viewer.id).maybeSingle(),
    supabase.from('posts').select(POST_SELECT).eq('author_id', viewer.id).is('org_id', null)
      .eq('likes.user_id', viewer.id).eq('initiative_joins.user_id', viewer.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('events').select('id, title, starts_at').gt('starts_at', new Date().toISOString()).order('starts_at').limit(20),
    supabase.from('user_follows').select('follower_id', { count: 'exact', head: true }).eq('followee_id', viewer.id),
    supabase.from('user_follows').select('followee_id', { count: 'exact', head: true }).eq('follower_id', viewer.id),
  ])
  const skills = (p?.skills ?? []) as string[]
  const donor = !!h?.is_blood_donor

  return (
    <main className="page profile-page">
      <section className="personal-header">
        <ProfileBanner userId={viewer.id} url={p?.banner_url ?? null} />
        <div className="personal-main">
          <ProfileAvatar userId={viewer.id} url={p?.avatar_url ?? null} initials={viewer.initials} />
          <div>
            <h1>{viewer.fullName}</h1>
            <p>{[p?.headline ?? 'Volunteer', p?.location].filter(Boolean).join(' · ')}</p>
            <p className="follow-count"><b>{followers.count ?? 0}</b> followers · <b>{following.count ?? 0}</b> following</p>
            {p?.identity_verified && <span className="profile-verified"><Icon name="check" size={14} /> Identity verified</span>}
          </div>
          <ProfileActions openInitially={searchParams.setup === '1'}
            initial={{ interests: p?.interests ?? [], fullName: viewer.fullName, location: p?.location ?? '', skills: skills.join(', '), bloodGroup: h?.blood_group ?? '', donor }} />
        </div>
      </section>

      <div className="profile-layout">
        <section className="content-card">
          <span className="eyebrow">CIVIC PROFILE</span>
          <h2>About {viewer.firstName}</h2>
          <p className="muted-copy">{p?.bio ?? 'Tell your community a little about yourself.'}</p>
          <div className="profile-facts">
            <div><Icon name="pin" /><span><b>{p?.location || 'Add your location'}</b><small>{p?.lat != null ? 'Local opportunities enabled' : 'Add precise location to see exact distances'}</small></span></div>
            <div><Icon name="spark" /><span><b>{skills.length ? skills.map((s, i) => (i ? s.toLowerCase() : s)).join(', ') : 'Add your skills'}</b><small>Skills shared with organizations</small></span></div>
            {h && (
              <div className="blood-fact"><Icon name="droplet" /><span>
                <b>{donor ? `${h.blood_group} emergency donor` : `${h.blood_group} blood group`}</b>
                <small>{donor ? 'Alerts from verified organizations enabled' : 'Emergency alerts are turned off'}</small>
              </span></div>
            )}
          </div>
        </section>
        <section className="content-card profile-score">
          <span className="eyebrow">VERIFIED IMPACT</span>
          <strong>{fmt(w?.points ?? 0)}</strong>
          <span>Civic points</span>
          <div>
            <b>{Number(w?.volunteer_hours ?? 0)}</b><small>Hours given</small>
            <b>{w?.good_deeds ?? 0}</b><small>Good deeds</small>
            <b>{w?.blood_donations ?? 0}</b><small>{(w?.blood_donations ?? 0) === 1 ? 'Blood donation' : 'Blood donations'}</small>
          </div>
        </section>
      </div>

      <section style={{ marginTop: 24, maxWidth: 760 }}>
        <div className="feed-heading"><div><span className="eyebrow">YOUR TIMELINE</span><h2>Posts by {viewer.firstName}</h2></div></div>
        <Composer userId={viewer.id} firstName={viewer.firstName} initials={viewer.initials} events={events.data ?? []} adminOrgs={[]} />
        <div style={{ marginTop: 14 }}>
          {posts.error && <p className="form-error" role="alert">Couldn’t load your posts: {posts.error.message}</p>}
          <FeedList initial={(posts.data ?? []).map(toFeedPost)} viewerId={viewer.id} viewerInitials={viewer.initials}
            authorId={viewer.id} personalOnly emptyTitle="You haven’t posted yet" emptyHint="Share an update. It appears here and in the global feed." />
        </div>
      </section>
    </main>
  )
}
