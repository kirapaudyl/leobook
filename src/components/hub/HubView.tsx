'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { Button, LinkButton } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { LocalText } from '@/components/LocalText'
import { FeedList } from '@/components/feed/FeedList'
import { BloodAlertPanel } from '@/components/hub/BloodAlertPanel'
import { createClient } from '@/lib/supabase/client'
import { clockTime, eventMed, greeting, initials } from '@/lib/format'
import type { FeedPost } from '@/lib/types'

export interface HubOrg {
  id: string; slug: string; name: string; type: string; tagline: string | null; about: string | null; headline: string | null
  verified: boolean; ai_verified: boolean; ai_verified_since: number | null; legal_status: string | null
  location: string | null; location_note: string | null; banner_url: string | null; cover_credit: string | null
  impact: { value: string; label: string }[]; lat: number | null; lng: number | null
}
interface Msg { id: string; author_id: string; body: string; created_at: string; name: string }
type Membership = 'none' | 'pending' | 'member' | 'admin'
const TABS = ['Events & Workshops', 'Community Posts', 'Impact Gallery', 'About'] as const
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 1 : 1).replace(/\.0$/, '')}K` : String(n))
const BLURB = 'Meet neighbors, learn practical skills, and contribute to a stronger local community.'

interface Props {
  org: HubOrg; followers: number; members: number; following: boolean; membership: Membership
  events: { id: string; title: string; description: string | null; format_label: string | null; kind: string; starts_at: string }[]
  posts: FeedPost[]; gallery: { id: string; url: string; caption: string | null }[]
  stats: { upcoming: number; hours: number; volunteers: number } | null
  messages: Msg[]; roster: { id: string; full_name: string | null }[]
  viewer: { id: string; firstName: string; initials: string }
  canSendBlood: boolean
}

export function HubView(p: Props) {
  const router = useRouter()
  const supabase = useRef(createClient()).current
  const { org } = p
  const [tab, setTab] = useState<(typeof TABS)[number]>('Events & Workshops')
  const [mode, setMode] = useState<'public' | 'member'>('public')
  const [following, setFollowing] = useState(p.following)
  const [followers, setFollowers] = useState(p.followers)
  const [membership, setMembership] = useState<Membership>(p.membership)
  const [msgs, setMsgs] = useState<Msg[]>(p.messages)
  const [draft, setDraft] = useState('')
  const [online, setOnline] = useState(1)
  const [modal, setModal] = useState<null | 'event' | 'activity' | 'blood'>(null)
  const names = useRef<Record<string, string>>(Object.fromEntries(p.messages.map((m) => [m.author_id, m.name])))
  const logRef = useRef<HTMLDivElement>(null)
  const isMember = membership === 'member' || membership === 'admin'

  const toggleFollow = async () => {
    const next = !following
    setFollowing(next); setFollowers((n) => n + (next ? 1 : -1))
    const { error } = next
      ? await supabase.from('org_followers').insert({ org_id: org.id, user_id: p.viewer.id })
      : await supabase.from('org_followers').delete().match({ org_id: org.id, user_id: p.viewer.id })
    if (error) { setFollowing(!next); setFollowers((n) => n + (next ? -1 : 1)) }
  }

  const requestJoin = async () => {
    if (membership !== 'none') return
    setMembership('pending')
    const { error } = await supabase.from('org_members').insert({ org_id: org.id, user_id: p.viewer.id, role: 'member', status: 'pending' })
    if (error) setMembership('none')
  }

  // Member chat: live messages + presence ("12 members online")
  const addMsg = useCallback(async (row: { id: string; author_id: string; body: string; created_at: string }) => {
    if (!names.current[row.author_id]) {
      const { data } = await supabase.from('profiles').select('full_name').eq('id', row.author_id).maybeSingle()
      names.current[row.author_id] = data?.full_name ?? 'Member'
    }
    setMsgs((m) => (m.some((x) => x.id === row.id) ? m : [...m, { ...row, name: names.current[row.author_id] }]))
  }, [supabase])

  useEffect(() => {
    if (!isMember) return
    const ch = supabase.channel(`hub:${org.id}`, { config: { presence: { key: p.viewer.id } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'org_messages', filter: `org_id=eq.${org.id}` }, (e) => addMsg(e.new as Msg))
      .on('presence', { event: 'sync' }, () => setOnline(Object.keys(ch.presenceState()).length))
      .subscribe((status) => { if (status === 'SUBSCRIBED') ch.track({ at: Date.now() }) })
    return () => { supabase.removeChannel(ch) }
  }, [supabase, org.id, p.viewer.id, isMember, addMsg])
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }) }, [msgs, mode])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setDraft('')
    const { data, error } = await supabase.from('org_messages').insert({ org_id: org.id, author_id: p.viewer.id, body }).select('id, author_id, body, created_at').single()
    if (error) return setDraft(body)
    names.current[p.viewer.id] = p.viewer.firstName
    addMsg(data)
  }

  const detail = (
    <div className="group-grid">
      <section className="content-card about">
        <span className="eyebrow">{tab === 'About' ? (org.name.includes('Foundation') ? 'ABOUT THE FOUNDATION' : 'ABOUT THE ORGANIZATION') : 'LATEST FROM THE HUB'}</span>
        <h2>{tab === 'About' ? org.headline ?? org.name : 'Neighbors creating visible change.'}</h2>
        <p>{org.about ?? org.tagline ?? 'This organization hasn’t added a description yet.'}</p>
        {org.impact.length > 0 && (
          <div className="impact-row">{org.impact.slice(0, 3).map((i) => <div key={i.label}><b>{i.value}</b><span>{i.label}</span></div>)}</div>
        )}
      </section>
      <section className="content-card upcoming">
        <div className="section-head"><h2>Organization details</h2></div>
        {org.location && <div className="org-detail"><Icon name="pin" /><span><b>{org.location}</b>{org.location_note && <small>{org.location_note}</small>}</span></div>}
        <div className="org-detail"><Icon name="check" /><span>
          <b>{org.legal_status ?? (org.verified ? 'Verified organization' : 'Organization')}</b>
          {org.verified && <small>Identity and records reviewed by LeoBook</small>}
        </span></div>
      </section>
    </div>
  )

  return (
    <main className="page">
      <section className="group-hero">
        <div className="group-pattern" style={org.banner_url ? { backgroundImage: `url(${org.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
          {org.cover_credit && <span className="cover-credit">{org.cover_credit}</span>}
        </div>
        <div className="group-info">
          <div className="big-org">{initials(org.name)}</div>
          <div>
            <div className="verified-line">
              <h1>{org.name}</h1>
              {org.verified && <span className="verified large"><Icon name="check" size={13} /></span>}
            </div>
            {org.tagline && <p>{org.tagline}</p>}
            <div className="group-stats">
              <span><b>{compact(followers)}</b> followers</span>
              <span><b>{compact(p.members)}</b> members</span>
              {org.ai_verified && <span><b>AI-verified</b>{org.ai_verified_since ? ` since ${org.ai_verified_since}` : ''}</span>}
            </div>
          </div>
        </div>
        <div className="profile-actions">
          {membership === 'admin' ? (
            <Button kind="secondary" icon="check" disabled>You manage this hub</Button>
          ) : (
            <>
              <Button icon={following ? 'check' : 'plus'} onClick={toggleFollow}>{following ? 'Following' : 'Follow'}</Button>
              <Button kind="secondary" icon={isMember ? 'check' : 'users'} onClick={requestJoin} disabled={membership !== 'none'}>
                {isMember ? 'Member' : membership === 'pending' ? 'Request sent' : 'Request to join hub'}
              </Button>
            </>
          )}
        </div>
        <div className="profile-tabs" role="tablist">
          {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}
        </div>
      </section>

      <div className="mode-toggle">
        <button className={mode === 'public' ? 'active' : ''} onClick={() => setMode('public')}>Public view</button>
        <button className={mode === 'member' ? 'active' : ''} onClick={() => setMode('member')}><Icon name="lock" size={16} /> Member workspace</button>
      </div>

      {mode === 'public' ? (
        tab === 'Events & Workshops' ? (
          p.events.length === 0 ? <div className="empty-state"><b>No upcoming events</b>Check back soon, or follow this hub to hear first.</div> : (
            <div className="curator-grid">
              {p.events.map((e, i) => (
                <article className="curator-card" key={e.id}>
                  <div className={`curator-image ci${i % 3}`}><span>{e.format_label ?? (e.kind === 'workshop' ? 'Workshop' : 'Event')}</span></div>
                  <div>
                    <small><LocalText>{eventMed(e.starts_at)}</LocalText></small>
                    <h2>{e.title}</h2>
                    <p>{e.description ?? BLURB}</p>
                    <LinkButton kind="secondary" href={`/explore?event=${e.id}`}>View event</LinkButton>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : tab === 'Impact Gallery' ? (
          p.gallery.length === 0 ? <div className="empty-state"><b>No photos yet</b>This hub hasn’t shared any impact photos.</div> : (
            <div className="gallery-grid">
              {p.gallery.map((g, i) => (
                <div key={g.id} className={i === 0 ? 'gallery-large' : `gallery-small g${i + 1}`}
                  style={{ backgroundImage: `url(${g.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                  {g.caption && <span>{g.caption}</span>}
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            {detail}
            {tab === 'Community Posts' && (
              <div style={{ marginTop: 24 }}>
                <FeedList initial={p.posts} viewerId={p.viewer.id} viewerInitials={p.viewer.initials} orgId={org.id} />
              </div>
            )}
          </>
        )
      ) : !isMember ? (
        <div className="empty-state">
          <b><Icon name="lock" size={16} /> Members only</b>
          {membership === 'pending' ? 'Your request is waiting for an organizer to approve it.' : 'Request to join this hub to unlock the member chat and workspace.'}
        </div>
      ) : (
        <div className="member-grid" style={membership === 'admin' ? undefined : { gridTemplateColumns: '1fr' }}>
          {membership === 'admin' && p.stats && (
            <section className="content-card admin">
              <div className="section-head">
                <div><span className="eyebrow">ADMIN DASHBOARD</span><h2><LocalText>{greeting()}</LocalText>, {p.viewer.firstName}</h2></div>
                <span className="secure"><Icon name="lock" size={15} /> Private</span>
              </div>
              <div className="admin-stats">
                <div><Icon name="calendar" /><b>{p.stats.upcoming}</b><span>Upcoming events</span></div>
                <div><Icon name="clock" /><b>{p.stats.hours}</b><span>Hours this month</span></div>
                <div><Icon name="users" /><b>{p.stats.volunteers}</b><span>Active volunteers</span></div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button icon="plus" onClick={() => setModal('event')}>Schedule an event</Button>
                <Button kind="secondary" icon="check" onClick={() => setModal('activity')}>Verify member activity</Button>
                {p.canSendBlood && <Button kind="secondary" icon="droplet" onClick={() => setModal('blood')}>Send blood alert</Button>}
              </div>
              {!p.canSendBlood && (
                <p className="form-note" style={{ marginTop: 12 }}>
                  {!org.verified
                    ? 'Blood alerts unlock once LeoBook verifies this organization.'
                    : 'Blood alerts are available to verified health organizations and verified organizations with 500+ followers.'}
                </p>
              )}
            </section>
          )}
          <section className="content-card chat">
            <div className="chat-head">
              <div><h2>Member chat</h2><span>{online} {online === 1 ? 'member' : 'members'} online</span></div>
              <Icon name="lock" size={18} />
            </div>
            <div className="chat-body" ref={logRef}>
              {msgs.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No messages yet. Say hello to your fellow members.</p>}
              {msgs.map((m) => m.author_id === p.viewer.id ? (
                <div className="chat-message mine" key={m.id}><p>{m.body}<small><LocalText>{clockTime(m.created_at)}</LocalText></small></p></div>
              ) : (
                <div className="chat-message" key={m.id}>
                  <span className="mini-avatar a0">{initials(m.name)}</span>
                  <p><b>{m.name.split(' ')[0]}</b>{m.body}<small><LocalText>{clockTime(m.created_at)}</LocalText></small></p>
                </div>
              ))}
            </div>
            <form className="chat-input" onSubmit={send}>
              <input aria-label="Message verified members" placeholder="Message verified members…" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} />
              <button aria-label="Send message"><Icon name="send" size={19} /></button>
            </form>
          </section>
        </div>
      )}

      {modal === 'event' && <ScheduleEvent org={org} onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh() }} />}
      {modal === 'blood' && p.canSendBlood && <BloodAlertPanel org={org} userId={p.viewer.id} onClose={() => setModal(null)} />}
      {modal === 'activity' && <VerifyActivity org={org} roster={p.roster} onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh() }} />}
    </main>
  )
}

function ScheduleEvent({ org, onClose, onDone }: { org: HubOrg; onClose: () => void; onDone: () => void }) {
  const supabase = useRef(createClient()).current
  const [f, setF] = useState({ title: '', when: '', location: org.location ?? '', cause: 'Environment', format: '', description: '', skills: '' })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const { error } = await supabase.from('events').insert({
      org_id: org.id, title: f.title.trim(), starts_at: new Date(f.when).toISOString(), location: f.location.trim() || null,
      cause: f.cause, format_label: f.format.trim() || null, description: f.description.trim() || null,
      skills_wanted: f.skills.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean), lat: org.lat, lng: org.lng,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone()
  }
  return (
    <Modal label="Schedule an event" onClose={onClose}>
      <form onSubmit={submit} className="onboard-content">
        <span className="eyebrow">ADMIN</span><h1>Schedule an event</h1>
        <label className="form-field"><span>Title</span><div><Icon name="calendar" size={19} /><input required value={f.title} onChange={(e) => set('title', e.target.value)} /></div></label>
        <label className="form-field"><span>Date and time</span><div><Icon name="clock" size={19} /><input required type="datetime-local" value={f.when} onChange={(e) => set('when', e.target.value)} /></div></label>
        <label className="form-field"><span>Location</span><div><Icon name="pin" size={19} /><input value={f.location} onChange={(e) => set('location', e.target.value)} /></div></label>
        <label className="form-field"><span>Cause</span><div><Icon name="leaf" size={19} />
          <select value={f.cause} onChange={(e) => set('cause', e.target.value)}>{['Environment', 'Education', 'Health', 'Relief'].map((c) => <option key={c}>{c}</option>)}</select></div></label>
        <label className="form-field"><span>Format label (optional)</span><div><Icon name="spark" size={19} /><input placeholder="Hands-on workshop" value={f.format} onChange={(e) => set('format', e.target.value)} /></div></label>
        <label className="form-field"><span>Helpful skills (comma separated)</span><div><Icon name="users" size={19} /><input placeholder="gardening, teaching" value={f.skills} onChange={(e) => set('skills', e.target.value)} /></div></label>
        <textarea className="composer-text" placeholder="What should volunteers expect?" value={f.description} onChange={(e) => set('description', e.target.value)} />
        {err && <p className="form-error" role="alert">{err}</p>}
        <Button className="full-button" disabled={busy}>{busy ? 'Scheduling…' : 'Schedule event'}</Button>
      </form>
    </Modal>
  )
}

function VerifyActivity({ org, roster, onClose, onDone }: { org: HubOrg; roster: { id: string; full_name: string | null }[]; onClose: () => void; onDone: () => void }) {
  const supabase = useRef(createClient()).current
  const [userId, setUserId] = useState('')
  const [kind, setKind] = useState('volunteer')
  const [amount, setAmount] = useState('1')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const n = Number(amount)
    const { error } = await supabase.from('good_deeds').insert({
      user_id: userId, org_id: org.id, kind, status: 'verified',
      hours: kind === 'volunteer' ? n : null, quantity: kind === 'invite' ? Math.max(1, Math.round(n)) : 1,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone()
  }
  return (
    <Modal label="Verify member activity" onClose={onClose}>
      <form onSubmit={submit} className="onboard-content">
        <span className="eyebrow">ADMIN</span><h1>Verify member activity</h1>
        <p>Verified activity grows the member’s world and counts toward their civic points.</p>
        <label className="form-field"><span>Member</span><div><Icon name="user" size={19} />
          <select required value={userId} onChange={(e) => setUserId(e.target.value)}><option value="" disabled>Select a member</option>
            {roster.map((r) => <option key={r.id} value={r.id}>{r.full_name ?? 'Member'}</option>)}</select></div></label>
        <label className="form-field"><span>Activity</span><div><Icon name="spark" size={19} />
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="volunteer">Volunteer hours</option><option value="invite">Invited volunteers</option>
            <option value="event">Took part in an event</option><option value="good_deed">Other good deed</option>
            {org.verified && <option value="blood_donation">Blood donation (health orgs only)</option>}
          </select></div></label>
        {(kind === 'volunteer' || kind === 'invite') && (
          <label className="form-field"><span>{kind === 'volunteer' ? 'Hours' : 'People invited'}</span>
            <div><Icon name="clock" size={19} /><input type="number" min="0.25" step="0.25" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div></label>
        )}
        {err && <p className="form-error" role="alert">{err}</p>}
        <Button className="full-button" disabled={busy || !userId}>{busy ? 'Saving…' : 'Verify activity'}</Button>
      </form>
    </Modal>
  )
}
