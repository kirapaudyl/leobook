'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { createClient } from '@/lib/supabase/client'
import { eventShort } from '@/lib/format'

interface Props {
  userId: string
  firstName: string
  initials: string
  events: { id: string; title: string; starts_at: string }[]
  adminOrgs: { id: string; name: string }[]
}

export function Composer({ userId, firstName, initials, events, adminOrgs }: Props) {
  const router = useRouter()
  const supabase = useRef(createClient()).current
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [eventId, setEventId] = useState('')
  const [showEvent, setShowEvent] = useState(false)
  const [location, setLocation] = useState('')
  const [orgId, setOrgId] = useState('')
  const [initiative, setInitiative] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function launch(o?: { photo?: boolean; event?: boolean }) {
    setOpen(true)
    if (o?.event) setShowEvent(true)
    if (o?.photo) setTimeout(() => fileRef.current?.click(), 60)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true); setError(null)
    try {
      const media: { url: string; type: 'image' | 'video' }[] = []
      for (const f of files) {
        const path = `${userId}/${crypto.randomUUID()}.${f.name.split('.').pop() ?? 'bin'}`
        const { error: up } = await supabase.storage.from('post-media').upload(path, f, { contentType: f.type })
        if (up) throw up
        media.push({ url: supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl, type: f.type.startsWith('video') ? 'video' : 'image' })
      }
      const { error: ins } = await supabase.from('posts').insert({
        author_id: userId, body: body.trim(), media, org_id: orgId || null, event_id: eventId || null,
        location_text: location.trim() || null, is_initiative: !!orgId && !!eventId && initiative,
      })
      if (ins) throw ins
      setBody(''); setFiles([]); setEventId(''); setShowEvent(false); setLocation(''); setOrgId(''); setInitiative(false); setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t publish your post. Try again.')
    } finally { setBusy(false) }
  }

  return (
    <>
      <section className="composer" aria-label="Create a post">
        <span className="avatar">{initials}</span>
        <button className="composer-prompt" onClick={() => launch()}>What’s on your mind, {firstName}?</button>
        <button className="composer-action" onClick={() => launch({ photo: true })}><Icon name="plus" size={19} /><span>Photo</span></button>
        <button className="composer-action" onClick={() => launch({ event: true })}><Icon name="calendar" size={19} /><span>Event</span></button>
      </section>

      {open && (
        <Modal label="Create a post" onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <div className="onboard-content">
              <span className="eyebrow">SHARE WITH YOUR COMMUNITY</span>
              <h1>Create a post</h1>
              {adminOrgs.length > 0 && (
                <label className="form-field">
                  <span>Post as</span>
                  <div>
                    <Icon name="users" size={19} />
                    <select className="select-plain" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                      <option value="">Myself</option>
                      {adminOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                </label>
              )}
              <textarea className="composer-text" autoFocus value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000}
                placeholder={`What’s on your mind, ${firstName}?`} aria-label="Post text" />
              {files.length > 0 && (
                <div className="chip-row">
                  {files.map((f, i) => <span key={i}>{f.name} <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} style={{ border: 0, background: 'none', color: 'inherit' }}>×</button></span>)}
                </div>
              )}
              {showEvent && (
                <label className="form-field">
                  <span>Tag an event</span>
                  <div>
                    <Icon name="calendar" size={19} />
                    <select className="select-plain" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                      <option value="">No event</option>
                      {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title} · {eventShort(ev.starts_at)}</option>)}
                    </select>
                  </div>
                </label>
              )}
              <label className="form-field">
                <span>Location</span>
                <div><Icon name="pin" size={19} /><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Add a location" /></div>
              </label>
              {orgId && eventId && (
                <label className="donor-toggle" style={{ marginTop: 12 }}>
                  <span><b>Open for volunteers</b><small>Adds a “Join campaign” button that RSVPs members to the tagged event.</small></span>
                  <input type="checkbox" checked={initiative} onChange={(e) => setInitiative(e.target.checked)} />
                  <i aria-hidden="true"></i>
                </label>
              )}
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="modal-actions">
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button type="button" kind="ghost" icon="plus" onClick={() => fileRef.current?.click()}>Photo</Button>
                  <Button type="button" kind="ghost" icon="calendar" onClick={() => setShowEvent((s) => !s)}>Event</Button>
                </div>
                <Button disabled={busy || !body.trim()}>{busy ? 'Posting…' : 'Post'}</Button>
              </div>
              <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden
                onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 6))} />
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
