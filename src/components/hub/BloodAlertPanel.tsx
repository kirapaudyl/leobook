'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { LocalText } from '@/components/LocalText'
import { createClient } from '@/lib/supabase/client'
import { NEPAL_PLACES, geocodePlace } from '@/lib/places'
import { minutesAgoLong } from '@/lib/format'

const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const PHONE_RE = /^[+0-9][0-9 ()-]{6,19}$/

interface Org { id: string; name: string; location: string | null; lat: number | null; lng: number | null }
interface Row {
  id: string; blood_group: string; units_needed: number; hospital: string
  status: 'active' | 'fulfilled' | 'expired' | 'cancelled'; created_at: string; expires_at: string
  notified: number; accepted: number
}

/** Send and manage blood alerts. The database decides who is allowed (verified + health or 500+ followers). */
export function BloodAlertPanel({ org, userId, onClose }: { org: Org; userId: string; onClose: () => void }) {
  const supabase = useRef(createClient()).current
  const [tab, setTab] = useState<'send' | 'history'>('send')

  // form
  const [group, setGroup] = useState('O+')
  const [units, setUnits] = useState('2')
  const [hospital, setHospital] = useState(org.name)
  const [area, setArea] = useState(org.location ?? '')
  const [by, setBy] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState<number | null>(null)

  // history
  const [rows, setRows] = useState<Row[] | null>(null)
  const loadHistory = useCallback(async () => {
    const { data: reqs } = await supabase.from('emergency_requests')
      .select('id, blood_group, units_needed, hospital, status, created_at, expires_at')
      .eq('org_id', org.id).order('created_at', { ascending: false }).limit(8)
    const list = reqs ?? []
    const ids = list.map((r) => r.id)
    const { data: ms } = ids.length
      ? await supabase.from('emergency_matches').select('request_id, response').in('request_id', ids)
      : { data: [] as { request_id: string; response: string | null }[] }
    setRows(list.map((r) => ({
      ...(r as Omit<Row, 'notified' | 'accepted'>),
      notified: (ms ?? []).filter((m) => m.request_id === r.id).length,
      accepted: (ms ?? []).filter((m) => m.request_id === r.id && m.response === 'accepted').length,
    })))
  }, [supabase, org.id])
  useEffect(() => { if (tab === 'history') void loadHistory() }, [tab, loadHistory])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const hosp = hospital.trim(), n = note.trim(), ph = phone.trim()
    if (hosp.length < 2) return setErr('Enter the hospital or collection point.')
    if (ph && !PHONE_RE.test(ph)) return setErr('Enter a valid contact number (digits, +, spaces, brackets or dashes).')
    if (by && new Date(by).getTime() <= Date.now()) return setErr('“Needed by” must be in the future.')
    if (!confirm) return setErr('Please confirm this is a real, current need.')

    setBusy(true)
    const where = geocodePlace(area)
    const { data, error } = await supabase.from('emergency_requests').insert({
      org_id: org.id, created_by: userId, blood_group: group, units_needed: Number(units),
      hospital: hosp, location: area.trim() || null,
      lat: where?.lat ?? org.lat, lng: where?.lng ?? org.lng,
      needed_by: by ? new Date(by).toISOString() : null,
      contact_phone: ph || null, note: n || null,
    }).select('id').single()
    if (error) { setBusy(false); return setErr(error.message) }
    const { count } = await supabase.from('emergency_matches')
      .select('id', { count: 'exact', head: true }).eq('request_id', data.id)
    setBusy(false); setSent(count ?? 0)
  }

  async function close(id: string, status: 'fulfilled' | 'cancelled') {
    const { error } = await supabase.from('emergency_requests').update({ status }).eq('id', id)
    if (error) return setErr(error.message)
    void loadHistory()
  }

  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)

  return (
    <Modal label="Send a blood alert" onClose={onClose}>
      <div className="onboard-content blood-panel">
        <span className="eyebrow">VERIFIED BLOOD ALERT</span>
        <h1>Send a blood alert</h1>
        <div className="blood-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'send'} className={tab === 'send' ? 'active' : ''} onClick={() => setTab('send')}>New alert</button>
          <button role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Sent alerts</button>
        </div>

        {tab === 'send' && (sent === null ? (
          <form onSubmit={submit}>
            <p>Opted-in donors with the same blood group (and no donation in the last 56 days) are alerted instantly.</p>
            <label className="form-field"><span>Blood group needed</span><div><Icon name="droplet" size={19} />
              <select value={group} onChange={(e) => setGroup(e.target.value)}>{GROUPS.map((g) => <option key={g}>{g}</option>)}</select></div></label>
            <label className="form-field"><span>Units needed</span><div><Icon name="plus" size={19} />
              <input type="number" min={1} max={50} required value={units} onChange={(e) => setUnits(e.target.value)} /></div></label>
            <label className="form-field"><span>Hospital or collection point</span><div><Icon name="pin" size={19} />
              <input required minLength={2} maxLength={120} value={hospital} onChange={(e) => setHospital(e.target.value)} /></div></label>
            <label className="form-field"><span>City or area</span><div><Icon name="pin" size={19} />
              <input list="blood-places" maxLength={80} value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Kathmandu" /></div></label>
            <datalist id="blood-places">{NEPAL_PLACES.map((p) => <option key={p.name} value={p.name} />)}</datalist>
            <label className="form-field"><span>Needed by (optional)</span><div><Icon name="clock" size={19} />
              <input type="datetime-local" min={nowLocal} value={by} onChange={(e) => setBy(e.target.value)} /></div></label>
            <label className="form-field"><span>Contact number (optional)</span><div><Icon name="users" size={19} />
              <input type="tel" inputMode="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+977 98…" /></div></label>
            <label className="form-field"><span>Note for donors (optional)</span><div><Icon name="spark" size={19} />
              <input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Ask for the blood bank desk, 2nd floor" /></div></label>
            <label className="blood-confirm">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
              <span>I confirm this is a real, current need. Misuse can lead to losing verified status.</span>
            </label>
            {err && <p className="form-error" role="alert">{err}</p>}
            <Button className="full-button" disabled={busy}>{busy ? 'Sending…' : 'Send alert'}</Button>
          </form>
        ) : (
          <p role="status"><b>Alert sent.</b> {sent === 0 ? 'No opted-in donors matched right now.' : `${sent} matching ${sent === 1 ? 'donor was' : 'donors were'} notified.`}</p>
        ))}

        {tab === 'history' && (
          rows === null ? <p>Loading…</p>
          : rows.length === 0 ? <div className="empty-state"><b>No alerts yet</b>Alerts you send will appear here.</div>
          : (
            <div className="blood-history">
              {err && <p className="form-error" role="alert">{err}</p>}
              {rows.map((r) => {
                const live = r.status === 'active' && new Date(r.expires_at).getTime() > Date.now()
                const label = live ? 'Active' : r.status === 'active' ? 'Expired' : r.status[0].toUpperCase() + r.status.slice(1)
                return (
                  <div className="blood-row" key={r.id}>
                    <div>
                      <b>{r.blood_group} · {r.units_needed} {r.units_needed === 1 ? 'unit' : 'units'}</b>
                      <small>{r.hospital} · <LocalText>{minutesAgoLong(r.created_at)}</LocalText></small>
                      <small>{r.notified} notified · {r.accepted} can donate</small>
                    </div>
                    <span className={`blood-pill ${live ? 'live' : ''}`}>{label}</span>
                    {live && (
                      <div className="blood-row-actions">
                        <button type="button" onClick={() => close(r.id, 'fulfilled')}>Mark fulfilled</button>
                        <button type="button" onClick={() => close(r.id, 'cancelled')}>Cancel</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </Modal>
  )
}
