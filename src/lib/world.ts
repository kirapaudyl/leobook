import type { IconName } from '@/components/Icon'

// Keep in sync with world_stage() and set_deed_points() in the SQL migration.
export const STAGES = [
  { key: 'seed',           label: 'Seed',             min: 0 },
  { key: 'small_plant',    label: 'Small Plant',      min: 200 },
  { key: 'farm',           label: 'Farm',             min: 500 },
  { key: 'caretaker_barn', label: 'Caretaker & Barn', min: 1000 },
  { key: 'thriving_world', label: 'Thriving World',   min: 1500 },
] as const

export function stageIndexFor(points: number) {
  let idx = 0
  STAGES.forEach((s, i) => { if (points >= s.min) idx = i })
  return idx
}

export function stageProgress(points: number) {
  const i = stageIndexFor(points)
  const next = STAGES[i + 1]
  return next ? (points - STAGES[i].min) / (next.min - STAGES[i].min) : 1
}

export type DeedKind = 'volunteer' | 'blood_donation' | 'invite' | 'event' | 'good_deed'

export interface Deed {
  id: string
  kind: DeedKind
  title: string | null
  hours: number | null
  quantity: number
  points: number
  verified_at: string | null
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const word = (n: number) => WORDS[n] ?? String(n)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const trimNum = (n: number) => String(Number(n))

/** Impact-log copy: what the real-world action did to the digital ecosystem. */
export function describeDeed(d: Deed): { icon: IconName; title: string; effect: string } {
  switch (d.kind) {
    case 'blood_donation':
      return { icon: 'droplet', title: 'Blood donation verified', effect: 'Your barn gained a community care station' }
    case 'volunteer':
      return { icon: 'clock', title: `${trimNum(d.hours ?? 0)} volunteer hours completed`, effect: 'A new field was planted' }
    case 'invite':
      return {
        icon: 'users',
        title: d.quantity === 1 ? 'Invited a new volunteer' : `Invited ${word(d.quantity)} new volunteers`,
        effect: d.quantity === 1 ? 'A fruit tree appeared' : `${cap(word(d.quantity))} fruit trees appeared`,
      }
    case 'event':
      return { icon: 'calendar', title: d.title ?? 'Took part in a community event', effect: 'A new bloom opened in your garden' }
    default:
      return { icon: 'heart', title: d.title ?? 'Good deed verified', effect: 'Your world grew a little brighter' }
  }
}

export function shortDate(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export interface BadgeDef { id: string; icon: IconName; title: string; copy: string; earned: (s: Stats) => boolean }
export interface Stats { points: number; hours: number; actions: number; invites: number; bloodDonations: number; streak: number; level: number }
export const BADGES: BadgeDef[] = [
  { id: 'sprout',  icon: 'leaf',    title: 'First Sprout',    copy: 'Complete 1 action',  earned: (s) => s.actions + s.bloodDonations >= 1 },
  { id: 'hand',    icon: 'heart',   title: 'Helping Hand',    copy: 'Give 25 hours',      earned: (s) => s.hours >= 25 },
  { id: 'bridge',  icon: 'users',   title: 'Bridge Builder',  copy: 'Invite 5 friends',   earned: (s) => s.invites >= 5 },
  { id: 'hero',    icon: 'award',   title: 'Local Hero',      copy: 'Earn 1,000 points',  earned: (s) => s.points >= 1000 },
  { id: 'life',    icon: 'droplet', title: 'Lifesaver',       copy: 'Donate blood once',  earned: (s) => s.bloodDonations >= 1 },
  { id: 'steady',  icon: 'clock',   title: 'Steady Hands',    copy: '4-week streak',      earned: (s) => s.streak >= 4 },
  { id: 'builder', icon: 'globe',   title: 'Community Builder', copy: 'Reach Level 5',    earned: (s) => s.level >= 5 },
]
