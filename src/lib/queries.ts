import type { FeedPost } from './types'

// IMPORTANT: every embed uses an explicit foreign-key hint (!constraint_name).
// `posts` ↔ `profiles` is reachable directly (author_id) AND through the likes /
// comments / initiative_joins junction tables, so a bare `profiles(...)` is ambiguous and
// PostgREST rejects the whole query (PGRST201).
export const POST_SELECT = `
  id, body, media, location_text, is_initiative, like_count, comment_count, join_count, share_count, created_at,
  author:profiles!posts_author_id_fkey(id, full_name, username, avatar_url),
  org:organizations!posts_org_id_fkey(id, slug, name, type, verified, ai_verified, logo_url),
  event:events!posts_event_id_fkey(id, title, starts_at, location),
  likes(user_id), initiative_joins(user_id)
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toFeedPost(row: any): FeedPost {
  const { likes, initiative_joins, ...rest } = row
  return { ...rest, liked: (likes?.length ?? 0) > 0, joined: (initiative_joins?.length ?? 0) > 0 }
}

/** PostgREST `or` filter for the Following tab: my posts + people I follow + orgs I follow. */
export function followingOr(me: string, people: string[], orgs: string[]): string {
  const parts = [`author_id.in.(${[me, ...people].join(',')})`]
  if (orgs.length) parts.push(`org_id.in.(${orgs.join(',')})`)
  return parts.join(',')
}
