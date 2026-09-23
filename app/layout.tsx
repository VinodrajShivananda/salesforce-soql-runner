import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SOQL Runner',
  description: 'Run Salesforce queries from a secure Vercel app.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
