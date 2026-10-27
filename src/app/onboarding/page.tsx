import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingFlow } from '@/components/profile/OnboardingFlow'

export default async function OnboardingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  return (
    <OnboardingFlow mode="first"
      initial={{ interests: [], fullName: p?.full_name ?? '', location: '', skills: '', bloodGroup: '', donor: true }} />
  )
}
