'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'
import { createClient } from '@/lib/supabase/client'
import { POST_SELECT, toFeedPost } from '@/lib/queries'
import { PostCard } from './PostCard'
import type { FeedPost } from '@/lib/types'

const PAGE = 10

export function FeedList({ initial, viewerId, viewerInitials, orFilter, orgId, authorId, personalOnly, emptyTitle, emptyHint }: {
  initial: FeedPost[]; viewerId: string; viewerInitials: string
  orFilter?: string | null; orgId?: string; authorId?: string; personalOnly?: boolean; emptyTitle?: string; emptyHint?: string
}) {
  const router = useRouter()
  const supabase = useRef(createClient()).current
  const [posts, setPosts] = useState(initial)
  const [done, setDone] = useState(initial.length < PAGE)
  const [loading, setLoading] = useState(false)
  const [fresh, setFresh] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setPosts(initial); setDone(initial.length < PAGE); setFresh(0) }, [initial])

  useEffect(() => {
    const ch = supabase.channel(`feed-new-posts-${orgId ?? 'all'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (p) => {
        const row = p.new as { author_id: string; org_id: string | null }
        if (row.author_id !== viewerId && (!orgId || row.org_id === orgId)) setFresh((n) => n + 1)
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase, viewerId, orgId])

  async function more() {
    setLoading(true)
    let q = supabase.from('posts').select(POST_SELECT).eq('likes.user_id', viewerId).eq('initiative_joins.user_id', viewerId)
      .order('created_at', { ascending: false }).limit(PAGE)
    const last = posts[posts.length - 1]
    if (last) q = q.lt('created_at', last.created_at)
    if (orFilter) q = q.or(orFilter)
    if (orgId) q = q.eq('org_id', orgId)
    if (authorId) q = q.eq('author_id', authorId)
    if (personalOnly) q = q.is('org_id', null)
    const { data, error: err } = await q
    if (err) { setError(err.message); setLoading(false); return }
    const next = (data ?? []).map(toFeedPost)
    setPosts((p) => [...p, ...next])
    if (next.length < PAGE) setDone(true)
    setLoading(false)
  }

  if (posts.length === 0) {
    return <div className="empty-state"><b>{emptyTitle ?? 'Nothing here yet'}</b>{emptyHint ?? 'Follow organizations and people, or share an update to start the conversation.'}</div>
  }
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {fresh > 0 && <Button className="load-more" onClick={() => { setFresh(0); router.refresh() }}>Show {fresh} new {fresh === 1 ? 'post' : 'posts'}</Button>}
      {posts.map((p) => <PostCard key={p.id} post={p} viewerId={viewerId} viewerInitials={viewerInitials} />)}
      {error && <p className="form-error" role="alert">Couldn’t load more posts: {error}</p>}
      {!done && <Button kind="secondary" className="load-more" onClick={more} disabled={loading}>{loading ? 'Loading…' : 'Load more'}</Button>}
    </div>
  )
}
