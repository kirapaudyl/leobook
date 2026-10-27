import { LinkButton } from '@/components/Button'
import { CreatePageButton } from '@/components/hub/CreatePage'
import { TYPE_LABEL } from '@/lib/hubTypes'
import { getViewer } from '@/lib/viewer'
import { distanceKm, formatKm } from '@/lib/geo'

interface Org { id: string; slug: string; name: string; type: string; tagline: string | null; location: string | null; lat: number | null; lng: number | null; verified: boolean; follower_count: number }
const COLS = 'id, slug, name, type, tagline, location, lat, lng, verified, follower_count'

function OrgGrid({ orgs, from, action }: { orgs: Org[]; from: { lat: number | null; lng: number | null }; action: string }) {
  return (
    <div className="curator-grid">
      {orgs.map((o, i) => {
        const km = distanceKm(from.lat, from.lng, o.lat, o.lng)
        return (
          <article className="curator-card" key={o.id}>
            <div className={`curator-image ci${i % 3}`}><span>{TYPE_LABEL[o.type] ?? 'Organization'}</span></div>
            <div>
              <small>{[o.location, km != null ? `${formatKm(km)} away` : null].filter(Boolean).join(' · ')}</small>
              <h2>{o.name}{o.verified ? ' ✓' : ''}</h2>
              <p>{o.tagline ?? 'No description yet.'}</p>
              <LinkButton kind="secondary" href={`/hubs/${o.slug}`}>{action}</LinkButton>
            </div>
          </article>
        )
      })}
    </div>
  )
}

export default async function HubsPage() {
  const { supabase, viewer } = await getViewer()
  const [mine, follows, member, all] = await Promise.all([
    supabase.from('organizations').select(COLS).eq('owner_id', viewer.id).order('created_at', { ascending: false }),
    supabase.from('org_followers').select(`org:organizations(${COLS})`).eq('user_id', viewer.id),
    supabase.from('org_members').select(`org:organizations(${COLS})`).eq('user_id', viewer.id).eq('status', 'approved'),
    supabase.from('organizations').select(COLS).order('follower_count', { ascending: false }).limit(60),
  ])
  const own = (mine.data ?? []) as Org[]
  const ownIds = new Set(own.map((o) => o.id))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pick = (rows: any[] | null) => (rows ?? []).flatMap((r) => (r.org ? [r.org as Org] : []))
  const joined = [...new Map([...pick(follows.data), ...pick(member.data)].filter((o) => !ownIds.has(o.id)).map((o) => [o.id, o])).values()]
  const seen = new Set([...ownIds, ...joined.map((o) => o.id)])
  const near = ((all.data ?? []) as Org[]).filter((o) => !seen.has(o.id))
    .sort((a, b) => (distanceKm(viewer.lat, viewer.lng, a.lat, a.lng) ?? 1e9) - (distanceKm(viewer.lat, viewer.lng, b.lat, b.lng) ?? 1e9)).slice(0, 9)
  const from = { lat: viewer.lat, lng: viewer.lng }

  return (
    <main className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">GROUPS &amp; HUBS</span>
          <h1>Pages and groups</h1>
          <p>Follow organizations, join groups, or start your own, all from your account.</p>
        </div>
        <CreatePageButton defaultPlace={viewer.location} />
      </div>

      {own.length > 0 && (<section style={{ marginBottom: 30 }}>
        <div className="feed-heading"><div><span className="eyebrow">YOU MANAGE</span><h2>Your pages and groups</h2></div></div>
        <OrgGrid orgs={own} from={from} action="Manage" />
      </section>)}

      {joined.length > 0 && (<section style={{ marginBottom: 30 }}>
        <div className="feed-heading"><div><span className="eyebrow">YOUR COMMUNITIES</span><h2>Following and joined</h2></div></div>
        <OrgGrid orgs={joined} from={from} action="Open hub" />
      </section>)}

      <section>
        <div className="feed-heading"><div><span className="eyebrow">NEAR {(viewer.location || 'YOU').toUpperCase()}</span><h2>Discover nearby</h2></div></div>
        {near.length === 0
          ? <div className="empty-state"><b>No other pages nearby yet</b>Be the first: create a page or group for your neighborhood.</div>
          : <OrgGrid orgs={near} from={from} action="View hub" />}
      </section>
    </main>
  )
}
