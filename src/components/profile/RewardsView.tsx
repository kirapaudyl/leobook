'use client'

import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { levelFor } from '@/lib/level'
import { BADGES, type Stats } from '@/lib/world'
import { fmt, initials } from '@/lib/format'
import type { LeaderRow } from '@/lib/types'

export function RewardsView({ stats, longestStreak, leaders, city }: { stats: Omit<Stats, 'level'>; longestStreak: number; leaders: LeaderRow[]; city: string }) {
  const [all, setAll] = useState(false)
  const lv = levelFor(stats.points)
  const full: Stats = { ...stats, level: lv.level }
  const earned = BADGES.filter((b) => b.earned(full))
  const shown = all ? BADGES : (earned.length ? earned : BADGES).slice(0, 4)

  return (
    <main className="page rewards-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">YOUR CIVIC JOURNEY</span>
          <h1>Every action leaves a mark.</h1>
          <p>Celebrate your progress, then find one more way to help.</p>
        </div>
      </div>

      <section className="rewards-hero">
        <div className="level-ring" style={{ background: `conic-gradient(var(--green-700) ${Math.round(lv.progress * 360)}deg, #e6edf5 0)` }}>
          <div><Icon name="award" size={40} /><strong>{lv.level}</strong><span>LEVEL</span></div>
        </div>
        <div className="level-copy">
          <span className="eyebrow">{lv.long.toUpperCase()}</span>
          <h2>{fmt(stats.points)} civic points</h2>
          <p>{lv.next ? <>Only <b>{fmt(lv.next.toGo)} points</b> until Level {lv.next.level}: {lv.next.title}</> : 'You’ve reached the top level. Thank you.'}</p>
          <div className="level-progress"><span style={{ width: `${Math.round(lv.progress * 100)}%` }}></span></div>
        </div>
        <div className="streak">
          <Icon name="spark" size={28} />
          <div>
            <b>{stats.streak} week streak</b>
            <span>{stats.streak > 0 && stats.streak >= longestStreak ? 'Your longest yet' : `Longest: ${longestStreak} weeks`}</span>
          </div>
        </div>
      </section>

      <div className="rewards-grid">
        <section className="content-card">
          <div className="section-head">
            <div><span className="eyebrow">YOUR COLLECTION</span><h2>Badges earned</h2></div>
            <button onClick={() => setAll(!all)}>{all ? 'Show earned' : `See all ${BADGES.length}`}</button>
          </div>
          <div className="badges">
            {shown.map((b) => (
              <div className={`badge-item ${b.earned(full) ? '' : 'locked'}`} key={b.id}>
                <span><Icon name={b.icon} size={28} /></span><b>{b.title}</b><small>{b.copy}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="content-card leaderboard full">
          <div className="section-head">
            <div><span className="eyebrow">{city.toUpperCase()} · THIS MONTH</span><h2>Community leaderboard</h2></div>
          </div>
          {leaders.length === 0 && <p className="muted-copy">The board fills in as organizations verify good deeds.</p>}
          {leaders.map((r, i) => (
            <div className={`leader-row ${r.is_me ? 'you' : ''}`} key={r.user_id}>
              <span className="rank">{r.rank}</span>
              <span className={`mini-avatar a${i % 3}`}>{initials(r.full_name)}</span>
              <b>{r.full_name ?? 'Member'}{r.is_me && <em>You</em>}</b>
              <small>{fmt(r.points)} pts</small>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
