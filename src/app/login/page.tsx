'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Icon, Logo } from '@/components/Icon'
import { Button } from '@/components/Button'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'signup' | 'code' | 'verify'

function Form() {
  const router = useRouter()
  const params = useSearchParams()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(params.get('error') ? 'Sign-in failed. Try again.' : null)
  const supabase = () => createClient()
  const redirectTo = () => `${location.origin}/auth/callback`

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase().auth.signInWithPassword({ email, password })
        if (error) return setMsg(error.message)
        router.replace('/feed'); router.refresh()
      } else if (mode === 'signup') {
        const { data, error } = await supabase().auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } })
        if (error) return setMsg(error.message)
        if (!data.session) return setMsg('Check your email to confirm your account, then log in.')
        router.replace('/feed'); router.refresh()
      } else if (mode === 'code') {
        const { error } = await supabase().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } })
        if (error) return setMsg(error.message)
        setMode('verify')
      } else {
        const { error } = await supabase().auth.verifyOtp({ email, token: code.trim(), type: 'email' })
        if (error) return setMsg('That code didn’t work. Check it and try again.')
        router.replace('/feed'); router.refresh()
      }
    } finally { setBusy(false) }
  }

  const heading = { login: 'Log in to LeoBook', signup: 'Create your account', code: 'Email me a code', verify: 'Check your email' }[mode]
  const sub = {
    login: 'Good things are happening near you.',
    signup: 'One account for everything. Create pages and groups from it later.',
    code: 'We’ll email you a one-time code. No password needed.',
    verify: `We sent a 6-digit code to ${email}.`,
  }[mode]

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <section className="onboarding" aria-labelledby="login-title">
        <Logo />
        <form className="onboard-content" onSubmit={submit}>
          <span className="eyebrow">LET’S GROW GOOD TOGETHER</span>
          <h1 id="login-title">{heading}</h1>
          <p>{sub}</p>

          {mode !== 'verify' && (
            <label className="form-field"><span>Email</span>
              <div><Icon name="mail" size={19} /><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div></label>
          )}
          {(mode === 'login' || mode === 'signup') && (
            <label className="form-field"><span>Password</span>
              <div><Icon name="lock" size={19} /><input type="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></div></label>
          )}
          {mode === 'verify' && (
            <label className="form-field"><span>One-time code</span>
              <div><Icon name="lock" size={19} /><input inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" /></div></label>
          )}

          {msg && <p className="form-error" role="alert">{msg}</p>}
          <Button className="full-button" disabled={busy}>
            {busy ? 'Please wait…' : { login: 'Log in', signup: 'Sign up', code: 'Email me a code', verify: 'Continue' }[mode]}
          </Button>

          {(mode === 'login' || mode === 'signup') && (
            <>
              <div style={{ margin: '14px 0 0' }}>
                <Button type="button" kind="secondary" className="full-button"
                  onClick={() => supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } })}>Continue with Google</Button>
              </div>
              <p style={{ textAlign: 'center', margin: '14px 0 0', fontSize: 13 }}>
                {mode === 'login'
                  ? <>New here? <a href="#" onClick={(e) => { e.preventDefault(); setMode('signup'); setMsg(null) }} style={{ color: 'var(--green-700)', fontWeight: 700 }}>Create an account</a></>
                  : <>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setMsg(null) }} style={{ color: 'var(--green-700)', fontWeight: 700 }}>Log in</a></>}
                {' · '}
                <a href="#" onClick={(e) => { e.preventDefault(); setMode('code'); setMsg(null) }} style={{ color: 'var(--muted)' }}>Email me a code instead</a>
              </p>
            </>
          )}
          {(mode === 'code' || mode === 'verify') && (
            <div style={{ marginTop: 10 }}><Button type="button" kind="ghost" onClick={() => { setMode('login'); setCode(''); setMsg(null) }}>Use a password instead</Button></div>
          )}
        </form>
      </section>
    </main>
  )
}
export default function LoginPage() { return <Suspense><Form /></Suspense> }
