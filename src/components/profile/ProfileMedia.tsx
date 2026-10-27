'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BUCKET = 'profile-media'
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_MB = { avatar: 2, banner: 5 } as const
type Kind = keyof typeof MAX_MB

function storagePathFromUrl(url: string | null, userId: string) {
  const marker = `/${BUCKET}/`
  if (!url?.includes(marker)) return null
  const old = decodeURIComponent(url.split(marker)[1])
  return old.startsWith(`${userId}/`) ? old : null
}

async function uploadProfileImage(userId: string, kind: Kind, file: File, previousUrl: string | null) {
  if (!ALLOWED.includes(file.type)) throw new Error('Please choose a JPG, PNG or WebP image.')
  if (file.size > MAX_MB[kind] * 1024 * 1024) throw new Error(`Image must be under ${MAX_MB[kind]} MB.`)

  const supabase = createClient()
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/${kind}-${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (upErr) throw new Error(upErr.message)

  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  const column = kind === 'avatar' ? 'avatar_url' : 'banner_url'
  const { error: dbErr } = await supabase.from('profiles').update({ [column]: url }).eq('id', userId)
  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([path]) // don't leave an orphan file
    throw new Error(dbErr.message)
  }

  const old = storagePathFromUrl(previousUrl, userId)
  if (old) await supabase.storage.from(BUCKET).remove([old])
  return url
}

async function removeProfileImage(userId: string, kind: Kind, previousUrl: string | null) {
  const supabase = createClient()
  const column = kind === 'avatar' ? 'avatar_url' : 'banner_url'
  const { error } = await supabase.from('profiles').update({ [column]: null }).eq('id', userId)
  if (error) throw new Error(error.message)
  const old = storagePathFromUrl(previousUrl, userId)
  if (old) await supabase.storage.from(BUCKET).remove([old])
}

function useImageEditor(userId: string, kind: Kind, url: string | null) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setErr(null)
    try { await fn(); router.refresh() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed') }
    finally { setBusy(false); if (input.current) input.current.value = '' }
  }
  return {
    input, busy, err,
    pick: () => input.current?.click(),
    onFile: (f?: File) => { if (f) void run(() => uploadProfileImage(userId, kind, f, url)) },
    remove: () => void run(() => removeProfileImage(userId, kind, url)),
  }
}

export function ProfileBanner({ userId, url }: { userId: string; url: string | null }) {
  const ed = useImageEditor(userId, 'banner', url)
  return (
    <div className={`personal-cover${url ? ' has-image' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img className="cover-img" src={url} alt="" />}
      <div className="media-actions">
        <button type="button" className="media-btn" onClick={ed.pick} disabled={ed.busy}>
          {ed.busy ? 'Uploading…' : url ? 'Change banner' : 'Add banner'}
        </button>
        {url && <button type="button" className="media-btn" onClick={ed.remove} disabled={ed.busy}>Remove</button>}
      </div>
      <input ref={ed.input} type="file" accept="image/jpeg,image/png,image/webp" hidden
        onChange={(e) => ed.onFile(e.target.files?.[0])} />
      {ed.err && <p className="media-error" role="alert">{ed.err}</p>}
    </div>
  )
}

export function ProfileAvatar({ userId, url, initials }: { userId: string; url: string | null; initials: string }) {
  const ed = useImageEditor(userId, 'avatar', url)
  return (
    <span className="avatar-edit">
      <span className="profile-avatar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img className="avatar-img" src={url} alt="Your profile photo" /> : initials}
      </span>
      <button type="button" className="avatar-cam" onClick={ed.pick} disabled={ed.busy}
        aria-label={url ? 'Change profile photo' : 'Add profile photo'} title={url ? 'Change photo' : 'Add photo'}>
        {ed.busy ? '…' : '📷'}
      </button>
      <input ref={ed.input} type="file" accept="image/jpeg,image/png,image/webp" hidden
        onChange={(e) => ed.onFile(e.target.files?.[0])} />
      {ed.err && <small className="media-error" role="alert">{ed.err}</small>}
    </span>
  )
}
