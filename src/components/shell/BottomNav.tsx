'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { NAV } from './Sidebar'

export function BottomNav() {
  const path = usePathname()
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {NAV.map((item) => (
        <Link key={item.href} href={item.href} className={path.startsWith(item.href) ? 'active' : ''}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
