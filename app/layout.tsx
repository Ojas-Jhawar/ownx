import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const description =
  'Ownx creates a verified digital record for everything you own: the original invoice and warranty, service history, condition and device health.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Ownx · The Ownership Passport for Physical Assets', template: '%s · Ownx' },
  description,
  openGraph: { title: 'Ownx', description, type: 'website', siteName: 'Ownx' },
  twitter: { card: 'summary_large_image', title: 'Ownx', description },
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

// The design system defines brand/ink tokens for light mode only, so lock to light.
export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: 'white',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
