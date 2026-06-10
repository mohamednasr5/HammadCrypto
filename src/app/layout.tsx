import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hammad Crypto Pro — محفظة العملات الرقمية',
  description: 'محفظة العملات الرقمية — تحليل AI وإدارة المحفظة الاحترافية',
  keywords: ['crypto', 'bitcoin', 'wallet', 'OKX', 'AI analysis', 'محفظة', 'عملات رقمية'],
  authors: [{ name: 'Mohamed Hammad' }],
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Hammad Crypto',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0e17',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased bg-[#0a0e17] text-[#dde3f0] overflow-hidden">
        {children}
      </body>
    </html>
  );
}
