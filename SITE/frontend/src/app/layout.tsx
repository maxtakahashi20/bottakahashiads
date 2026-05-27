import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Takahashi Ads — Painel SaaS',
  description: 'Configure seu bot de divulgação Discord'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
