'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { createClient } from '@/lib/supabase/client'

export function FollowButton({ meId, targetId, initialFollowing, initialCount }: { meId: string; targetId: string; initialFollowing: boolean; initialCount: number }) {
  const supabase = useRef(createClient()).current
  const [following, setFollowing] = useState(initialFollowing)
  const [count, setCount] = useState(initialCount)

  async function toggle() {
    const next = !following
    setFollowing(next); setCount((c) => c + (next ? 1 : -1))
    const { error } = next
      ? await supabase.from('user_follows').insert({ follower_id: meId, followee_id: targetId })
      : await supabase.from('user_follows').delete().match({ follower_id: meId, followee_id: targetId })
    if (error) { setFollowing(!next); setCount((c) => c + (next ? -1 : 1)) }
  }

  return (
    <div className="follow-row">
      <Button icon={following ? 'check' : 'plus'} kind={following ? 'secondary' : 'primary'} onClick={toggle}>{following ? 'Following' : 'Follow'}</Button>
      <span className="follow-count"><b>{count}</b> {count === 1 ? 'follower' : 'followers'}</span>
    </div>
  )
}
