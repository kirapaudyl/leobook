import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { LocalText } from '@/components/LocalText'
import { eventShort, initials } from '@/lib/format'
import { formatKm } from '@/lib/geo'
import type { LeaderRow, Opportunity } from '@/lib/types'

export function RightRail({ opportunity: o, leaders }: { opportunity: Opportunity | null; leaders: LeaderRow[] }) {
  return (
    <aside className="right-rail">
      <section className="rail-card">
        <div className="section-head">
          <div>
            <span className="eyebrow">MATCHED FOR YOU</span>
            <h2>Nearby ways to help</h2>
          </div>
          <Link href="/explore">See all</Link>
        </div>
        {!o ? (
          <p style={{ padding: '4px 4px 8px', margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            No upcoming opportunities yet. Add your skills and location so we can match you.
          </p>
        ) : (
          <div className="match-card">
            <div className="match-img" style={o.cover_url ? { backgroundImage: `url(${o.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
            <div className="match-content">
              {o.cause && <span className={`tag ${o.cause.toLowerCase()}`}>{o.cause}</span>}
              <h3>{o.title}</h3>
              <p><Icon name="calendar" size={15} /> <LocalText>{eventShort(o.starts_at)}</LocalText></p>
              {o.distance_km != null && <p><Icon name="pin" size={15} /> {formatKm(o.distance_km)} away</p>}
              <div className="match-bottom">
                <div className="people">
                  {o.attendees.slice(0, 2).map((n, i) => <span key={i}>{initials(n)}</span>)}
                  {o.attendee_count > 2 && <span>+{o.attendee_count - 2}</span>}
                </div>
                <Link href={`/explore?event=${o.id}`} aria-label={`View ${o.title}`}><button tabIndex={-1} aria-hidden><Icon name="arrow" size={19} /></button></Link>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rail-card leaderboard">
        <div className="section-head">
          <div>
            <span className="eyebrow">THIS WEEK</span>
            <h2>Community sparks</h2>
          </div>
          <Link href="/rewards">View board</Link>
        </div>
        {leaders.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Verified good deeds show up here each week.</p>}
        {leaders.map((r, i) => (
          <div className={`leader-row ${r.is_me ? 'you' : ''}`} key={r.user_id}>
            <span className="rank">{r.rank}</span>
            <span className={`mini-avatar a${i % 3}`}>{r.is_me ? 'Y' : initials(r.full_name)}</span>
            <b>{r.is_me ? 'You' : r.full_name ?? 'Member'}</b>
            <small>{r.points.toLocaleString('en-US')} pts</small>
          </div>
        ))}
      </section>
    </aside>
  )
}
