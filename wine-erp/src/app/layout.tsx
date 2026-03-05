import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Mono, DM_Sans } from 'next/font/google'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
  preload: true,
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
  preload: true,
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
})

export const metadata: Metadata = {
  title: {
    template: '%s | Wine ERP',
    default: "LY's Cellars — Hệ Thống Quản Lý Nhập Khẩu Rượu Vang",
  },
  description: 'Hệ thống ERP chuyên ngành nhập khẩu và phân phối rượu vang cao cấp tại Việt Nam',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${cormorant.variable} ${dmMono.variable} ${dmSans.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
