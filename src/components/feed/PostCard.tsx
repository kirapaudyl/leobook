'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/Button'
import { LocalText } from '@/components/LocalText'
import { createClient } from '@/lib/supabase/client'
import { campaignWhen, initials, timeAgo } from '@/lib/format'
import type { FeedPost } from '@/lib/types'

interface Comment { id: string; body: string; author: { full_name: string | null } | null }

const orgLabel = (o: NonNullable<FeedPost['org']>) =>
  o.ai_verified ? 'AI-verified organization' : o.verified ? 'Verified organization' : 'Organization'

export function PostCard({ post: initial, viewerId, viewerInitials }: { post: FeedPost; viewerId: string; viewerInitials: string }) {
  const router = useRouter()
  const supabase = useRef(createClient()).current
  const [post, setPost] = useState(initial)
  const [menu, setMenu] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState<string | null>(null)

  const name = post.org?.name ?? post.author.full_name ?? 'Member'
  const photo = post.media.find((m) => m.type === 'image')
  const profileHref = post.org ? `/hubs/${post.org.slug}` : post.author.id === viewerId ? '/profile' : `/people/${post.author.id}`

  async function toggleLike() {
    const liked = !post.liked
    const step = liked ? 1 : -1
    setPost((p) => ({ ...p, liked, like_count: Math.max(0, p.like_count + step) }))
    const { error } = liked
      ? await supabase.from('likes').insert({ post_id: post.id, user_id: viewerId })
      : await supabase.from('likes').delete().match({ post_id: post.id, user_id: viewerId })
    if (error) setPost((p) => ({ ...p, liked: !liked, like_count: Math.max(0, p.like_count - step) }))
  }

  async function toggleJoin() {
    const joined = !post.joined
    setPost((p) => ({ ...p, joined, join_count: p.join_count + (joined ? 1 : -1) }))
    const { error } = joined
      ? await supabase.from('initiative_joins').insert({ post_id: post.id, user_id: viewerId })
      : await supabase.from('initiative_joins').delete().match({ post_id: post.id, user_id: viewerId })
    if (error) setPost((p) => ({ ...p, joined: !joined, join_count: p.join_count + (joined ? -1 : 1) }))
  }

  async function share() {
    const url = `${location.origin}/feed#post-${post.id}`
    try {
      if (navigator.share) await navigator.share({ title: name, text: post.body.slice(0, 120), url })
      else { await navigator.clipboard.writeText(url); setNote('Link copied'); setTimeout(() => setNote(null), 2000) }
      const { data } = await supabase.rpc('share_post', { p_post: post.id })
      if (typeof data === 'number') setPost((p) => ({ ...p, share_count: data }))
    } catch { /* cancelled */ }
  }

  async function toggleComments() {
    const next = !showComments
    setShowComments(next)
    if (next && comments === null) {
      const { data } = await supabase.from('comments').select('id, body, author:profiles(full_name)')
        .eq('post_id', post.id).order('created_at').limit(50)
      setComments((data as unknown as Comment[]) ?? [])
    }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setDraft('')
    const { data, error } = await supabase.from('comments').insert({ post_id: post.id, author_id: viewerId, body })
      .select('id, body, author:profiles(full_name)').single()
    if (error) return setDraft(body)
    setComments((c) => [...(c ?? []), data as unknown as Comment])
    setPost((p) => ({ ...p, comment_count: p.comment_count + 1 }))
  }

  async function remove() {
    if (!confirm('Delete this post?')) return
    await supabase.from('posts').delete().eq('id', post.id)
    router.refresh()
  }

  return (
    <article className="post-card" id={`post-${post.id}`}>
      <div className="post-head">
        <Link href={profileHref} aria-label={`Open ${name}`}>{post.org ? <div className="org-logo">{initials(post.org.name)}</div> : <span className="avatar">{initials(name)}</span>}</Link>
        <div>
          <div className="verified-line">
            <Link href={profileHref}><b className="author-link">{name}</b></Link>
            {post.org?.verified && <span className="verified"><Icon name="check" size={11} /></span>}
          </div>
          <small>
            {post.org ? `${orgLabel(post.org)} · ` : ''}<LocalText>{timeAgo(post.created_at)}</LocalText>
            {post.location_text ? ` · ${post.location_text}` : ''}
          </small>
        </div>
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button className="more-button" aria-label="More post options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>•••</button>
          {menu && (
            <div className="pop" style={{ top: 44, width: 180 }} role="menu">
              <button role="menuitem" className="pop-item" onClick={() => { share(); setMenu(false) }}>Copy link</button>
              {post.author.id === viewerId && <button role="menuitem" className="pop-item" style={{ color: 'var(--red)' }} onClick={remove}>Delete post</button>}
            </div>
          )}
        </div>
      </div>

      <p className="post-text">{post.body}</p>

      {photo && (
        <div className="post-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />
          {photo.credit && <span className="photo-credit">{photo.credit}</span>}
        </div>
      )}

      {post.event && (
        <div className="campaign-strip">
          <div>
            <Icon name="calendar" size={18} />
            <span>
              <b>{post.event.title}</b>
              <small><LocalText>{campaignWhen(post.event.starts_at)}</LocalText>{post.event.location ? ` · ${post.event.location}` : ''}</small>
            </span>
          </div>
          {post.is_initiative && (
            <Button onClick={toggleJoin} kind={post.joined ? 'secondary' : 'primary'}>
              {post.joined ? "You're joining" : 'Join campaign'}
            </Button>
          )}
        </div>
      )}

      <div className="social-proof">
        <span><i>♥</i> {post.like_count.toLocaleString('en-US')} people appreciate this</span>
        <span>{post.comment_count} comments · {post.share_count} shares</span>
      </div>

      <div className="post-actions">
        <button className={post.liked ? 'liked' : ''} onClick={toggleLike} aria-pressed={post.liked}>
          <Icon name="heart" size={20} /> {post.liked ? 'Liked' : 'Like'}
        </button>
        <button onClick={toggleComments} aria-expanded={showComments}><Icon name="message" size={20} /> Comment</button>
        <button onClick={share}><Icon name="share" size={20} /> Share</button>
      </div>
      {note && <p role="status" style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', margin: '0 0 10px' }}>{note}</p>}

      {showComments && (
        <div className="comments">
          {comments === null && <small style={{ color: 'var(--muted)' }}>Loading…</small>}
          {comments?.map((c) => (
            <div className="comment" key={c.id}>
              <span className="mini-avatar a1">{initials(c.author?.full_name)}</span>
              <p><b>{c.author?.full_name ?? 'Member'}</b>{c.body}</p>
            </div>
          ))}
          <form className="comment-form" onSubmit={addComment} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="mini-avatar a0">{viewerInitials}</span>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a comment" aria-label="Write a comment" maxLength={2000} />
          </form>
        </div>
      )}
    </article>
  )
}
