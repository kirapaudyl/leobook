'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon, Logo } from '@/components/Icon'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { createClient } from '@/lib/supabase/client'
import { NEPAL_PLACES, geocodePlace } from '@/lib/places'

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const
const INTERESTS = ['Environment', 'Education', 'Health & wellbeing', 'Food security', 'Disaster relief', 'Animal welfare']

export interface ProfileDraft {
  interests: string[]; fullName: string; location: string
  skills: string; bloodGroup: string; donor: boolean
}

/**
 * Two steps, same for everyone (like signing up for Facebook): what you care about, then who/where you are.
 * `first` = mandatory after sign-up; `edit` = reopened from your profile (no re-picking an account type: there isn't one).
 * Pages and groups are created separately from Groups & Hubs.
 */
export function OnboardingFlow({ mode, initial, onClose }: { mode: 'first' | 'edit'; initial: ProfileDraft; onClose?: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState(mode === 'edit' ? 2 : 1)
  const [d, setD] = useState(initial)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => setD((x) => ({ ...x, [k]: v }))

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setError(null) },
      () => setError('We couldn’t get your location. You can still type your city.'),
      { timeout: 8000 },
    )
  }

  async function finish() {
    if (d.fullName.trim().length < 2) return setError('Enter your full name.')
    if (d.location.trim().length < 2) return setError('Enter your city or area.')
    if (!d.bloodGroup) return setError('Blood group is required.')
    const where = coords ?? geocodePlace(d.location)
    setBusy(true); setError(null)
    const { error: err } = await createClient().rpc('complete_onboarding', {
      p_interests: d.interests, p_full_name: d.fullName, p_location: d.location,
      p_skills: d.skills.split(',').map((x) => x.trim()).filter(Boolean),
      p_blood_group: d.bloodGroup, p_donor: d.donor, p_lat: where?.lat ?? null, p_lng: where?.lng ?? null,
    })
    setBusy(false)
    if (err) return setError(err.message)
    if (mode === 'first') router.replace('/feed')
    else onClose?.()
    router.refresh()
  }

  return (
    <Modal label="Profile setup" onClose={onClose ?? (() => {})} closable={mode === 'edit'}>
      <Logo />
      <div className="stepper"><span className="done"></span><span className={step >= 2 ? 'done' : ''}></span></div>

      {step === 1 && (
        <div className="onboard-content">
          <span className="eyebrow">WELCOME TO LEOBOOK</span>
          <h1>What makes you care?</h1>
          <p>Pick as many causes as you like. We’ll use these for thoughtful recommendations.</p>
          <div className="interest-grid">
            {INTERESTS.map((item) => {
              const on = d.interests.includes(item)
              return (
                <button key={item} className={on ? 'selected' : ''} aria-pressed={on}
                  onClick={() => set('interests', on ? d.interests.filter((i) => i !== item) : [...d.interests, item])}>
                  {item}<Icon name={on ? 'check' : 'plus'} size={17} />
                </button>
              )
            })}
          </div>
          <Button className="full-button" onClick={() => setStep(2)}>Continue <Icon name="arrow" size={18} /></Button>
        </div>
      )}

      {step === 2 && (
        <div className="onboard-content">
          <span className="eyebrow">SAFETY &amp; LOCAL MATCHING</span>
          <h1>Complete your civic profile.</h1>
          <p>Your details help match you with nearby opportunities and relevant verified emergency requests.</p>
          <label className="form-field"><span>Full name</span>
            <div><Icon name="user" size={19} /><input value={d.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="name" /></div></label>
          <label className="form-field"><span>City or area</span>
            <div><Icon name="pin" size={19} /><input list="nepal-places" placeholder="e.g. Kathmandu, Lalitpur, Bhaktapur" value={d.location} onChange={(e) => set('location', e.target.value)} autoComplete="off" /></div></label>
          <datalist id="nepal-places">{NEPAL_PLACES.map((p) => <option key={p.name} value={p.name} />)}</datalist>
          <button type="button" onClick={locate} style={{ border: 0, background: 'none', color: 'var(--green-700)', fontWeight: 600, fontSize: 13, margin: '-4px 0 10px', padding: 0 }}>
            {coords ? 'Precise location captured' : 'Use my current location for exact distances'}
          </button>
          <label className="form-field"><span>Skills you’d like to share</span>
            <div><Icon name="spark" size={19} /><input value={d.skills} onChange={(e) => set('skills', e.target.value)} placeholder="Teaching, first aid, gardening" /></div></label>
          <label className="form-field"><span>Blood group <b>Required</b></span>
            <div><Icon name="droplet" size={19} />
              <select aria-label="Blood group" value={d.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)} required>
                <option value="" disabled>Select</option>
                {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
              </select></div></label>
          <label className="donor-toggle">
            <span><b>Receive emergency blood requests</b><small>Only from verified organizations matching your blood group.</small></span>
            <input type="checkbox" checked={d.donor} onChange={(e) => set('donor', e.target.checked)} />
            <i aria-hidden="true"></i>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button className="full-button" onClick={finish} disabled={busy}>{busy ? 'Saving…' : mode === 'first' ? 'Finish my profile' : 'Save changes'}</Button>
          <small className="privacy"><Icon name="lock" size={14} /> Your health information is private and always in your control.</small>
          <div style={{ marginTop: 10 }}><Button kind="ghost" onClick={() => setStep(1)}>Back</Button></div>
        </div>
      )}
    </Modal>
  )
}
