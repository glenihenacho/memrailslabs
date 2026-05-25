import type { Metadata } from 'next';
import { Nav } from '@/components/shared/Nav';
import { Footer } from '@/components/shared/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: 'MemRails — Knowledge density infrastructure for agentic software',
  description:
    'Turn messy knowledge into compact, evidence-graded packets that agents can query, inspect, stream, and pay for.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@1,72,500;1,72,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
