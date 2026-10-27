'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { createClient } from '@/lib/supabase/client'
import { NEPAL_PLACES, geocodePlace } from '@/lib/places'
import { TYPE_LABEL } from '@/lib/hubTypes'

/** "Create a page or group": any signed-in person can do this from their own account (like Facebook). */
export function CreatePageButton({ defaultPlace }: { defaultPlace: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', type: 'collective', location: defaultPlace, about: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const where = geocodePlace(f.location)
    const { data, error } = await createClient().rpc('create_page', {
      p_name: f.name, p_type: f.type, p_location: f.location, p_about: f.about, p_lat: where?.lat ?? null, p_lng: where?.lng ?? null,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    router.push(`/hubs/${data}`); router.refresh()
  }

  return (
    <>
      <Button icon="plus" onClick={() => setOpen(true)}>Create a page or group</Button>
      {open && (
        <Modal label="Create a page or group" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="onboard-content">
            <span className="eyebrow">FROM YOUR ACCOUNT</span>
            <h1>Create a page or group</h1>
            <p>You’ll manage it from your own account. Post as it, schedule events and run its member chat.</p>
            <label className="form-field"><span>Name</span><div><Icon name="users" size={19} /><input required minLength={2} value={f.name} onChange={(e) => set('name', e.target.value)} /></div></label>
            <label className="form-field"><span>Type</span><div><Icon name="leaf" size={19} />
              <select value={f.type} onChange={(e) => set('type', e.target.value)}>
                {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></div></label>
            <label className="form-field"><span>City or area</span><div><Icon name="pin" size={19} /><input list="nepal-places-2" value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Kathmandu" /></div></label>
            <datalist id="nepal-places-2">{NEPAL_PLACES.map((p) => <option key={p.name} value={p.name} />)}</datalist>
            <label className="form-field"><span>What is it about?</span><div><Icon name="spark" size={19} /><input value={f.about} onChange={(e) => set('about', e.target.value)} placeholder="Short description" /></div></label>
            {f.type === 'health' && <p className="form-note">Health pages can raise blood requests only after LeoBook verifies them.</p>}
            {err && <p className="form-error" role="alert">{err}</p>}
            <Button className="full-button" disabled={busy}>{busy ? 'Creating…' : 'Create'}</Button>
          </form>
        </Modal>
      )}
    </>
  )
}
