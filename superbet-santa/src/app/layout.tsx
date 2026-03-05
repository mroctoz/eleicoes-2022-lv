import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SuperBet: Santa',
  description: 'O melhor site de SuperBets e desafios.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body>{children}</body>
    </html>
  )
}