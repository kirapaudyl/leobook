'use client'

import { useEffect } from 'react'
import { Icon } from './Icon'

/** Uses the design's onboarding-modal chrome for every dialog in the app. */
export function Modal({ label, onClose, children, closable = true }: { label: string; onClose: () => void; children: React.ReactNode; closable?: boolean }) {
  useEffect(() => {
    if (!closable) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose, closable])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={closable ? onClose : undefined}>
      <section className="onboarding" role="dialog" aria-modal="true" aria-label={label} onMouseDown={(e) => e.stopPropagation()}>
        {closable && <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" /></button>}
        {children}
      </section>
    </div>
  )
}
