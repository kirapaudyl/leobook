'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/Button'
import { LocalText } from '@/components/LocalText'
import { createClient } from '@/lib/supabase/client'
import { clockTime, minutesAgoLong } from '@/lib/format'
import { formatKm } from '@/lib/geo'
import type { EmergencyCard } from '@/lib/types'

export function BloodAlert({ userId, card }: { userId: string; card: EmergencyCard | null }) {
  const router = useRouter()
  const supabase = useRef(createClient()).current
  const [responded, setResponded] = useState(card?.response === 'accepted')
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // A verified health org raises a request → DB trigger inserts our match → we get it live.
  useEffect(() => {
    const ch = supabase.channel(`emergency:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emergency_matches', filter: `user_id=eq.${userId}` }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase, userId, router])
  useEffect(() => { setResponded(card?.response === 'accepted') }, [card?.matchId, card?.response])

  if (!card) return null

  async function donate() {
    if (responded) return router.push('/explore')
    setBusy(true)
    const { error } = await supabase.from('emergency_matches')
      .update({ response: 'accepted', responded_at: new Date().toISOString() }).eq('id', card!.matchId)
    setBusy(false)
    if (error) return setNote('Couldn’t send your response. Try again.')
    setResponded(true)
    router.push('/explore')
  }

  async function share() {
    const text = `${card!.bloodGroup} blood needed at ${card!.hospital}`
    try {
      if (navigator.share) await navigator.share({ title: 'Urgent blood request', text, url: location.href })
      else { await navigator.clipboard.writeText(`${text} ${location.href}`); setNote('Link copied.') }
    } catch { /* dismissed */ }
  }

  const where = card.distanceKm != null ? `The hospital is ${formatKm(card.distanceKm)} away` : `The request is at ${card.hospital}`

  return (
    <section className="blood-alert" aria-label="Verified emergency blood request" role="alert">
      <div className="blood-icon"><Icon name="droplet" size={23} /></div>
      <div className="blood-copy">
        <div>
          <span>VERIFIED BLOOD ALERT</span>
          <small><LocalText>Posted {minutesAgoLong(card.postedAt)}</LocalText></small>
        </div>
        <h2>{card.bloodGroup} blood needed at {card.hospital}</h2>
        <p>
          Your registered blood group is a match. {where}
          {card.neededBy && <> and needs donors before <LocalText>{clockTime(card.neededBy)}</LocalText></>}.
        </p>
        {card.orgName && <p style={{ marginTop: 6 }}>Sent by <b>{card.orgName}</b></p>}
        {card.note && <p style={{ marginTop: 4 }}>{card.note}</p>}
        {card.contactPhone && <p style={{ marginTop: 4 }}>Contact: <a href={`tel:${card.contactPhone.replace(/[^+0-9]/g, '')}`}>{card.contactPhone}</a></p>}
        {note && <p role="status" style={{ marginTop: 6 }}>{note}</p>}
      </div>
      <div className="blood-actions">
        <Button onClick={donate} disabled={busy}>{responded ? 'Opening directions' : 'I can donate'}</Button>
        <Button kind="ghost" icon="share" onClick={share}>Share alert</Button>
      </div>
    </section>
  )
}
