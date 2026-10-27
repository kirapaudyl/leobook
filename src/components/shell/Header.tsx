'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon, Logo } from '@/components/Icon'
import { createClient } from '@/lib/supabase/client'
import { timeAgo } from '@/lib/format'

interface Notif { id: string; title: string; body: string | null; read_at: string | null; created_at: string }

export function Header({ userId, name, initials, levelLabel }: { userId: string; name: string; initials: string; levelLabel: string }) {
  const router = useRouter()
  const supabase = useRef(createClient()).current
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const unread = items.filter((n) => !n.read_at).length

  const load = useCallback(async () => {
    const { data } = await supabase.from('notifications')
      .select('id, title, body, read_at, created_at').order('created_at', { ascending: false }).limit(8)
    setItems((data as Notif[]) ?? [])
  }, [supabase])

  useEffect(() => {
    load()
    const ch = supabase.channel(`notifs:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => { load(); router.refresh() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase, userId, load, router])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
      setItems((p) => p.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
      router.refresh()
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="mobile-logo"><Logo /></div>
        <form role="search" className="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`) }}>
          <Icon name="search" size={20} />
          <input aria-label="Search campaigns, people, or organizations" placeholder="Search LeoBook" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <div className="top-actions">
          <button className={`icon-button notification ${unread === 0 ? 'read' : ''}`} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={toggle}>
            <Icon name="bell" />
          </button>
          {open && (
            <div className="pop" role="menu">
              {items.length === 0 ? <p style={{ padding: 14, margin: 0, fontSize: 13, color: 'var(--muted)' }}>You&apos;re all caught up.</p> : items.map((n) => (
                <div key={n.id} className="pop-item">
                  <b>{n.title}</b>
                  {n.body && <small>{n.body}</small>}
                  <small suppressHydrationWarning>{timeAgo(n.created_at)}</small>
                </div>
              ))}
            </div>
          )}
          <Link href="/profile" className="profile-button" aria-label="Open your profile">
            <span className="avatar">{initials}</span>
            <span className="profile-copy">
              <b>{name}</b>
              <small>{levelLabel}</small>
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}
