import type { Metadata } from 'next'
import { Cormorant_Garamond, JetBrains_Mono, Inter } from 'next/font/google'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
  preload: true,
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
  display: 'swap',
  preload: true,
})

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
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

import { Toaster } from 'sonner'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${cormorant.variable} ${jetbrainsMono.variable} ${inter.variable}`}
    >
      <body>
        {children}
        <Toaster position="bottom-right" richColors theme="dark" />
      </body>
    </html>
  )
}
