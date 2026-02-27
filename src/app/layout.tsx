import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'Crypto Trading Dashboard',
  description: 'Real-time cryptocurrency trading dashboard with live WebSocket data',
  openGraph: {
    title: 'Crypto Trading Dashboard',
    description: 'Real-time cryptocurrency trading dashboard with live WebSocket data',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crypto Trading Dashboard',
    description: 'Real-time cryptocurrency trading dashboard with live WebSocket data',
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
        <link rel="preconnect" href="https://api.binance.com" />
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
