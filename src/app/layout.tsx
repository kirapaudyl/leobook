import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'LeoBook', description: 'Good things are happening in your community.' }
export const viewport: Viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
