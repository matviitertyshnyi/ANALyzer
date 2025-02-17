'use client';

import Header from './Header';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#1E1E2D]">
      <Header />
      <div className="container mx-auto py-6">
        {children}
      </div>
    </div>
  );
}
