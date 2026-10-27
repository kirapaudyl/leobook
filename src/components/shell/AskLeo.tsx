'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/Icon'

interface Msg { role: 'user' | 'assistant'; content: string }

export function AskLeo() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, open])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    const next = [...msgs, { role: 'user' as const, content: text }]
    setMsgs(next); setInput(''); setBusy(true)
    try {
      const res = await fetch('/api/ask-leo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next }) })
      const json = await res.json()
      setMsgs([...next, { role: 'assistant', content: json.reply ?? json.error ?? 'Something went wrong. Try again.' }])
    } catch {
      setMsgs([...next, { role: 'assistant', content: 'I couldn’t reach the server. Try again in a moment.' }])
    } finally { setBusy(false) }
  }

  return (
    <>
      {open && (
        <section className="ask-panel" aria-label="Ask Leo">
          <header><span>Ask Leo</span><button onClick={() => setOpen(false)} aria-label="Close"><Icon name="x" size={18} /></button></header>
          <div className="ask-log">
            {msgs.length === 0 && <p>Hi, I&apos;m Leo. Ask me how to find ways to help nearby, how campaigns work, or how blood alerts reach you.</p>}
            {msgs.map((m, i) => <p key={i} className={m.role === 'user' ? 'me' : ''}>{m.content}</p>)}
            {busy && <p>Leo is thinking…</p>}
            <div ref={end} />
          </div>
          <form onSubmit={send}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything" aria-label="Message Leo" />
            <button disabled={busy} aria-label="Send"><Icon name="send" size={18} /></button>
          </form>
        </section>
      )}
      <button className="ai-button" aria-label="Ask Leo AI assistant" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="spark" size={23} /><span>Ask Leo</span>
      </button>
    </>
  )
}
