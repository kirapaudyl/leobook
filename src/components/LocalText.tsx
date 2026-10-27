'use client'
/** Strings that depend on the viewer's clock/time zone legitimately differ between server and client render. */
export function LocalText({ children }: { children: React.ReactNode }) {
  return <span suppressHydrationWarning>{children}</span>
}
