import { Sidebar } from '@/components/shell/Sidebar'
import { Header } from '@/components/shell/Header'
import { BottomNav } from '@/components/shell/BottomNav'
import { AskLeo } from '@/components/shell/AskLeo'
import { getViewer } from '@/lib/viewer'
import { levelFor } from '@/lib/level'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { viewer, hubBadge } = await getViewer()
  const { level, short } = levelFor(viewer.points)
  return (
    <div className="app-shell">
      <Sidebar hubBadge={hubBadge} nudge={viewer.profileGap} />
      <Header userId={viewer.id} name={viewer.fullName} initials={viewer.initials} levelLabel={`Level ${level} · ${short}`} />
      <div className="app-content">{children}</div>
      <BottomNav />
      <AskLeo />
    </div>
  )
}
