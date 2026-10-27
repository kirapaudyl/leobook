import Link from 'next/link'
import { getViewer } from '@/lib/viewer'
import { initials } from '@/lib/format'

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const { supabase } = await getViewer()
  const q = (searchParams.q ?? '').trim().replace(/[%,]/g, ' ')
  const [orgs, events, people] = q ? await Promise.all([
    supabase.from('organizations').select('id, name, slug, tagline').ilike('name', `%${q}%`).limit(6),
    supabase.from('events').select('id, title, location').ilike('title', `%${q}%`).order('starts_at').limit(6),
    supabase.from('profiles').select('id, full_name, location').ilike('full_name', `%${q}%`).eq('onboarded', true).limit(6),
  ]) : [null, null, null]
  const none = q && !orgs?.data?.length && !events?.data?.length && !people?.data?.length

  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <div className="page-title"><div><span className="eyebrow">SEARCH</span><h1>{q ? `Results for “${q}”` : 'Search LeoBook'}</h1></div></div>
      {none && <div className="empty-state"><b>Nothing matched</b>Try a different name, event or place.</div>}
      <div style={{ display: 'grid', gap: 18 }}>
        {!!orgs?.data?.length && <section className="content-card"><div className="section-head"><h2>Organizations</h2></div>
          {orgs.data.map((o) => <Link key={o.id} href={`/hubs/${o.slug}`} className="leader-row"><span className="mini-avatar a0">{initials(o.name)}</span><b>{o.name}</b><small>{o.tagline}</small></Link>)}</section>}
        {!!events?.data?.length && <section className="content-card"><div className="section-head"><h2>Events</h2></div>
          {events.data.map((e) => <Link key={e.id} href={`/explore?event=${e.id}`} className="leader-row"><span className="mini-avatar a1"><span>•</span></span><b>{e.title}</b><small>{e.location}</small></Link>)}</section>}
        {!!people?.data?.length && <section className="content-card"><div className="section-head"><h2>People</h2></div>
          {people.data.map((p) => <Link key={p.id} href={`/people/${p.id}`} className="leader-row"><span className="mini-avatar a2">{initials(p.full_name)}</span><b>{p.full_name}</b><small>{p.location}</small></Link>)}</section>}
      </div>
    </main>
  )
}
