'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'
import { createClient } from '@/lib/supabase/client'
import { OnboardingFlow, type ProfileDraft } from './OnboardingFlow'

export function ProfileActions({ initial, openInitially }: { initial: ProfileDraft; openInitially: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(openInitially)
  async function signOut() {
    await createClient().auth.signOut()
    router.replace('/login'); router.refresh()
  }
  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button kind="secondary" onClick={() => setOpen(true)}>Edit civic profile</Button>
        <Button kind="ghost" onClick={signOut}>Sign out</Button>
      </div>
      {open && <OnboardingFlow mode="edit" initial={initial} onClose={() => { setOpen(false); router.replace('/profile') }} />}
    </>
  )
}
