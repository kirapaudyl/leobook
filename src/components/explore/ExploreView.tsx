'use client'

import dynamic from 'next/dynamic'
import { useMemo, useRef, useState } from 'react'
import { Icon } from '@/components/Icon'
import Link from 'next/link'
import { Button } from '@/components/Button'
import { LocalText } from '@/components/LocalText'
import { createClient } from '@/lib/supabase/client'
import { eventShort } from '@/lib/format'
import { formatKm } from '@/lib/geo'

export interface ExploreEvent {
  id: string; title: string; description: string | null; cause: string; starts_at: string
  location: string | null; lat: number | null; lng: number | null; points: number
  skills: string[]; distanceKm: number | null; going: number; registered: boolean
}

const CAUSES = ['All causes', 'Environment', 'Education', 'Health', 'Relief']
const LiveMap = dynamic(() => import('./LiveMap'), { ssr: false, loading: () => <div className="map-live" aria-busy="true" /> })
const DEFAULT_BLURB = 'Join neighbors for a welcoming, hands-on event. All experience levels are welcome and supplies are provided.'

export interface NearbyOrg { id: string; slug: string; name: string; type: string; location: string | null; verified: boolean; km: number | null }

export function ExploreView({ events: initial, userId, location, initialId, me, center, orgs }: {
  events: ExploreEvent[]; userId: string; location: string; initialId?: string
  me: { lat: number; lng: number } | null; center: { lat: number; lng: number }; orgs: NearbyOrg[]
}) {
  const supabase = useRef(createClient()).current
  const [events, setEvents] = useState(initial)
  const [filter, setFilter] = useState('All causes')
  const [place, setPlace] = useState('')
  const [selectedId, setSelectedId] = useState(initialId ?? initial[0]?.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const visible = useMemo(() => events.filter((e) =>
    (filter === 'All causes' || e.cause.toLowerCase() === filter.toLowerCase()) &&
    (!place.trim() || (e.location ?? '').toLowerCase().includes(place.trim().toLowerCase()))), [events, filter, place])
  const selected = visible.find((e) => e.id === selectedId) ?? visible[0]

  async function toggleRegister() {
    if (!selected) return
    setBusy(true); setError(null)
    const joining = !selected.registered
    const { error: err } = joining
      ? await supabase.from('event_rsvps').insert({ event_id: selected.id, user_id: userId })
      : await supabase.from('event_rsvps').delete().match({ event_id: selected.id, user_id: userId })
    setBusy(false)
    if (err) return setError('Couldn’t update your registration. Try again.')
    setEvents((all) => all.map((e) => e.id === selected.id ? { ...e, registered: joining, going: e.going + (joining ? 1 : -1) } : e))
  }

  return (
    <main className="page page-map">
      <div className="page-title">
        <div>
          <span className="eyebrow">EXPLORE NEARBY</span>
          <h1>Find your next good deed</h1>
          <p>Opportunities matched to your location, interests, and skills.</p>
        </div>
        <label className="location-search">
          <Icon name="pin" size={19} />
          <input aria-label="Filter by location" placeholder={location || 'Filter by place'} value={place} onChange={(e) => setPlace(e.target.value)} />
        </label>
      </div>

      <div className="filters" aria-label="Event filters">
        {CAUSES.map((c) => <button key={c} className={filter === c ? 'active' : ''} onClick={() => setFilter(c)}>{c}</button>)}
      </div>

      <section className="map-shell">
        <div className="map-art">
          <LiveMap events={visible.slice(0, 40)} selectedId={selected?.id} me={me} center={center}
            onSelect={(id) => { setSelectedId(id); setError(null) }} />
        </div>

        <div className="event-drawer">
          {!selected ? (
            <div className="empty-state" style={{ border: 0, padding: 12 }}><b>No events match</b>Try another cause or clear the place filter.</div>
          ) : (
            <>
              <span className={`tag ${selected.cause.toLowerCase()}`}>{selected.cause}</span>
              <h2>{selected.title}</h2>
              <p>{selected.description ?? DEFAULT_BLURB}</p>
              <div className="detail-grid">
                <span><Icon name="calendar" /><LocalText>{eventShort(selected.starts_at)}</LocalText></span>
                <span><Icon name="pin" />{selected.distanceKm != null ? `${formatKm(selected.distanceKm)} away` : selected.location ?? 'Location TBC'}</span>
                <span><Icon name="users" />{selected.going} {selected.going === 1 ? 'person' : 'people'} joining</span>
                <span><Icon name="spark" />+{selected.points} civic points</span>
              </div>
              {selected.skills.length > 0 && (
                <div className="skills">
                  <b>Helpful skills</b>
                  {selected.skills.map((s) => <span key={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>)}
                </div>
              )}
              <Button icon={selected.registered ? 'check' : undefined} onClick={toggleRegister} disabled={busy}>
                {selected.registered ? "You're registered" : 'Register / Participate'}
              </Button>
              {error && <p className="form-error" role="alert">{error}</p>}
            </>
          )}
        </div>
      </section>

      {visible.length > 0 && (
        <section className="rail-card leaderboard" style={{ marginTop: 22 }} aria-label="All matching events">
          <div className="section-head"><div><span className="eyebrow">{visible.length} {visible.length === 1 ? 'EVENT' : 'EVENTS'}</span><h2>All matching events</h2></div></div>
          {visible.map((e, i) => (
            <button key={e.id} className={`leader-row ${selected?.id === e.id ? 'you' : ''}`} onClick={() => { setSelectedId(e.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              style={{ width: '100%', border: 0, textAlign: 'left', background: selected?.id === e.id ? undefined : 'transparent' }}>
              <span className="rank">{i + 1}</span>
              <span className={`tag ${e.cause.toLowerCase()}`}>{e.cause}</span>
              <b>{e.title}</b>
              <small>{e.distanceKm != null ? formatKm(e.distanceKm) : e.location}</small>
            </button>
          ))}
        </section>
      )}

      {orgs.length > 0 && (
        <section className="rail-card leaderboard" style={{ marginTop: 22 }} aria-label="Organizations near you">
          <div className="section-head">
            <div><span className="eyebrow">NEAR {(location || 'YOU').toUpperCase()}</span><h2>Organizations nearby</h2></div>
            <Link href="/hubs">See all</Link>
          </div>
          {orgs.map((o, i) => (
            <Link key={o.id} href={`/hubs/${o.slug}`} className="leader-row">
              <span className={`mini-avatar a${i % 3}`}>{o.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}</span>
              <b>{o.name}</b>
              <small>{o.km != null ? formatKm(o.km) : o.location}</small>
            </Link>
          ))}
        </section>
      )}
    </main>
  )
}
