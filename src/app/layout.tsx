import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const SITE_URL = 'https://crypto-trading-dashboard-nine.vercel.app';

export const metadata: Metadata = {
  title: 'Crypto Trading Dashboard',
  description: 'Real-time cryptocurrency trading dashboard with live WebSocket data',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Crypto Trading Dashboard',
    description: 'Real-time cryptocurrency trading dashboard with live WebSocket data',
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'CryptoDash',
    images: [
      {
        url: '/og-image.png',
        width: 1400,
        height: 750,
        alt: 'Crypto Trading Dashboard — real-time chart, orderbook, futures trading',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crypto Trading Dashboard',
    description: 'Real-time cryptocurrency trading dashboard with live WebSocket data',
    images: ['/og-image.png'],
  },
  other: {
    'color-scheme': 'dark light',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://stream.binance.com" />
        <link rel="preconnect" href="https://data-api.binance.vision" />
        <link rel="preconnect" href="https://api.upbit.com" />
        <meta name="theme-color" content="#0a0a0b" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
      </head>
      <body className="select-none">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
