'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { PixelWorld } from './PixelWorld'
import { Button } from '@/components/Button'
import { LocalText } from '@/components/LocalText'
import { createClient } from '@/lib/supabase/client'
import { levelFor } from '@/lib/level'
import { STAGES, describeDeed, shortDate, stageIndexFor, stageProgress, type Deed } from '@/lib/world'

export interface WorldStats { hours: number; invites: number; events: number; blood: number }

export function WorldView({ userId, points: initialPoints, deeds: initialDeeds, stats: initialStats }: { userId: string; points: number; deeds: Deed[]; stats: WorldStats }) {
  const router = useRouter()
  const supabase = useRef(createClient()).current
  const [points, setPoints] = useState(initialPoints)
  const [deeds, setDeeds] = useState(initialDeeds)
  const [drawer, setDrawer] = useState(true)
  const [stats, setStats] = useState(initialStats)
  const [tip, setTip] = useState<{ title: string; text: string } | null>(null)
  const [night, setNight] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)
  const prevStage = useRef(stageIndexFor(initialPoints))

  const refresh = useCallback(async () => {
    const [{ data: w }, { data: d }, { count: ev }] = await Promise.all([
      supabase.from('user_world').select('points, volunteer_hours, blood_donations, invites').eq('user_id', userId).maybeSingle(),
      supabase.from('good_deeds').select('id, kind, title, hours, quantity, points, verified_at')
        .eq('user_id', userId).eq('status', 'verified').order('verified_at', { ascending: false }).limit(20),
      supabase.from('good_deeds').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'verified').eq('kind', 'event'),
    ])
    setPoints(w?.points ?? 0); setDeeds((d ?? []) as Deed[])
    setStats({ hours: Number(w?.volunteer_hours ?? 0), invites: w?.invites ?? 0, events: ev ?? 0, blood: w?.blood_donations ?? 0 })
    router.refresh()
  }, [supabase, userId, router])

  // Verified deeds recorded by organizations grow the world live.
  useEffect(() => {
    const ch = supabase.channel(`world:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'good_deeds', filter: `user_id=eq.${userId}` }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase, userId, refresh])

  const effective = preview ?? points
  const s = preview != null ? preview : stageIndexFor(points)
  const stagePoints = preview != null ? STAGES[preview].min + 1 : points
  const next = STAGES[s + 1]
  const pct = Math.round(stageProgress(stagePoints) * 100)
  const level = preview != null ? preview + 1 : levelFor(effective).level
  const real = preview == null
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
  // Counts come from verified deeds. Previews show a generous sample so every chapter is visible.
  const crops = real ? clamp(3 + Math.floor(stats.hours / 2), 3, 10) : 8
  const fruitTrees = real ? clamp(stats.invites, 0, 3) : 2
  const flowers = real ? clamp(stats.events, 0, 8) : 5
  const careStation = real ? stats.blood > 0 : true

  useEffect(() => {
    if (s > prevStage.current) {
      setTip({ title: 'Your world grew!', text: `It is now a ${STAGES[s].label}.` })
    }
    prevStage.current = s
  }, [s])

  return (
    <main className="page world-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">YOUR WORLD · LEVEL {level}</span>
          <h1>A world grown by real-world good.</h1>
          <p>Your verified deeds automatically nurture this landscape. No check-ins or manual tracking needed.</p>
        </div>
        <Button kind="secondary" icon="clock" onClick={() => setDrawer(!drawer)}>{drawer ? 'Hide impact log' : 'View impact log'}</Button>
      </div>

      <section className="mc-stage" aria-label={`Your world: ${STAGES[s].label}`}>
        <PixelWorld stage={s} growth={stageProgress(stagePoints)} crops={crops} fruitTrees={fruitTrees} flowers={flowers}
          careStation={careStation} night={night} onInspect={setTip} />
        <div className="mc-tip" role="status" aria-live="polite">
          {tip ? <><b>{tip.title}</b>{tip.text}</> : <>Tap anything in your world to inspect it.</>}
        </div>
        <button className="mc-toggle" onClick={() => setNight((n) => !n)} aria-pressed={night}>{night ? 'DAY' : 'NIGHT'}</button>
        <div className="mc-hud">
          <span>CURRENT CHAPTER{preview != null ? ' (PREVIEW)' : ''}</span>
          <b>{STAGES[s].label}</b>
          <small>{next ? `Next: ${next.label} · ${Math.max(0, next.min - stagePoints).toLocaleString('en-US')} points to go` : 'Your world is thriving. Keep it growing.'}</small>
          <div className="mc-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }}></i></div>
        </div>
      </section>

      <div className="world-steps">
        {STAGES.map((st, i) => (
          <div key={st.key} className={i <= s ? 'complete' : i === s + 1 ? 'next' : ''} role="button" tabIndex={0}
            aria-label={`Preview ${st.label}`}
            onClick={() => setPreview(i === stageIndexFor(points) ? null : i)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreview(i === stageIndexFor(points) ? null : i) } }}>
            <span>{i <= s ? <Icon name="check" size={15} /> : i + 1}</span>
            <b>{st.label}</b>
          </div>
        ))}
      </div>

      <p className="form-note" style={{ margin: '-6px 0 18px' }}>
        {preview != null
          ? <>Previewing {STAGES[preview].label}. <a href="#" onClick={(e) => { e.preventDefault(); setPreview(null) }} style={{ color: 'var(--green-700)', fontWeight: 700 }}>Back to my world</a></>
          : 'Tap a chapter to preview how your world will grow.'}
      </p>

      {drawer && (
        <section className="impact-log">
          <div className="section-head">
            <div>
              <span className="eyebrow">AUTOMATED IMPACT LOG</span>
              <h2>What nurtured your world</h2>
            </div>
            <small>Verified activity only</small>
          </div>
          {deeds.length === 0 && <div className="impact-entry"><span><Icon name="leaf" /></span><div><b>Your world is waiting for its first deed</b><p>Join a campaign or donate blood. Once an organization verifies it, your world grows.</p></div><small></small></div>}
          {deeds.map((d) => {
            const x = describeDeed(d)
            return (
              <div className="impact-entry" key={d.id}>
                <span><Icon name={x.icon} /></span>
                <div><b>{x.title}</b><p>{x.effect}</p></div>
                <small>+{d.points} pts · <LocalText>{shortDate(d.verified_at)}</LocalText></small>
              </div>
            )
          })}
        </section>
      )}
    </main>
  )
}
