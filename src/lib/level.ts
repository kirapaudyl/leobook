// Level ladder from verified civic points. Level 4 → 5 at 1,500 matches the design
// ("Only 220 points until Level 5" at 1,280).
const LEVELS = [
  { min: 0,    short: 'Newcomer',        long: 'Welcome Neighbor' },
  { min: 200,  short: 'Helper',          long: 'Neighborhood Helper' },
  { min: 500,  short: 'Contributor',     long: 'Active Contributor' },
  { min: 1000, short: 'Changemaker',     long: 'Neighborhood Changemaker' },
  { min: 1500, short: 'Community Builder', long: 'Community Builder' },
  { min: 2500, short: 'Local Pillar',    long: 'Local Pillar' },
]

export function levelFor(points: number) {
  let i = 0
  LEVELS.forEach((l, idx) => { if (points >= l.min) i = idx })
  const next = LEVELS[i + 1]
  return {
    level: i + 1,
    short: LEVELS[i].short,
    long: LEVELS[i].long,
    next: next ? { level: i + 2, title: next.long, toGo: next.min - points } : null,
    progress: next ? (points - LEVELS[i].min) / (next.min - LEVELS[i].min) : 1,
  }
}
