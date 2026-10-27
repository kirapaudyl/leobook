'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, Logo, type IconName } from '@/components/Icon'

export const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/feed', label: 'Home Feed', icon: 'home' },
  { href: '/explore', label: 'Explore & Events', icon: 'map' },
  { href: '/world', label: 'Your World', icon: 'globe' },
  { href: '/hubs', label: 'Groups & Hubs', icon: 'users' },
  { href: '/profile', label: 'Profile', icon: 'user' },
]

export function Sidebar({ hubBadge, nudge }: { hubBadge: number; nudge: string | null }) {
  const path = usePathname()
  return (
    <aside className="sidebar">
      <Link href="/feed" aria-label="LeoBook home"><Logo /></Link>
      <nav aria-label="Primary navigation">
        {NAV.map((item) => {
          const active = path === item.href || path.startsWith(`${item.href}/`)
          return (
            <Link key={item.href} href={item.href} className={`nav-item ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.href === '/hubs' && hubBadge > 0 && <i aria-label={`${hubBadge} new`}>{hubBadge}</i>}
            </Link>
          )
        })}
      </nav>
      {nudge && (
        <div className="sidebar-card">
          <span className="side-spark"><Icon name="spark" size={18} /></span>
          <b>Make your matches better</b>
          <p>{nudge}</p>
          <Link href="/profile?setup=1" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'white', fontSize: 13, fontWeight: 700 }}>
            Complete profile <Icon name="arrow" size={16} />
          </Link>
        </div>
      )}
      <div className="side-footer">
        <Link href="/search" style={{ color: 'var(--muted)', fontSize: 11 }}>Help &amp; accessibility</Link>
        <span>LeoBook © {new Date().getFullYear()}</span>
      </div>
    </aside>
  )
}
