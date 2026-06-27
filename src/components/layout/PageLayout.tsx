import type { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

interface PageLayoutProps {
  children: ReactNode;
  /** Classes for the outer wrapper. Defaults to the standard page shell. */
  className?: string;
}

/** Page shell that wraps content between the shared Header and Footer. */
export function PageLayout({
  children,
  className = 'min-h-screen bg-[#f8f9fa]',
}: PageLayoutProps) {
  return (
    <div className={className}>
      <Header />
      {children}
      <Footer />
    </div>
  );
}
