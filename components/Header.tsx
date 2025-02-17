'use client';  // Add this at the top

import Link from 'next/link';
import { useRouter } from 'next/router';  // Use next/router instead of next/navigation

export default function Header() {
  const router = useRouter();  // Use router.pathname instead of usePathname

  return (
    <header className="bg-[#1E1E2D] border-b border-[#2B2B40] p-4">
      <nav className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-6">
          <Link href="/" className="text-xl font-bold">Trading Bot</Link>
          <div className="flex space-x-4">
            <NavLink href="/dashboard" active={router.pathname === '/dashboard'}>Dashboard</NavLink>
            <NavLink href="/positions" active={router.pathname === '/positions'}>Positions</NavLink>
            <NavLink href="/backtest" active={router.pathname === '/backtest'}>Backtesting</NavLink>
            <NavLink href="/strategies" active={router.pathname === '/strategies'}>Strategies</NavLink>
            <NavLink href="/ml" active={router.pathname === '/ml'}>Machine Learning</NavLink>
          </div>
        </div>
      </nav>
    </header>
  );
}

const NavLink = ({ href, children, active }: { 
  href: string; 
  children: React.ReactNode; 
  active: boolean;
}) => (
  <Link 
    href={href}
    className={`px-4 py-2 rounded-lg transition-colors ${
      active 
        ? 'bg-[#2B2B40] text-[#3699FF]' 
        : 'text-gray-400 hover:text-white hover:bg-[#2B2B40]'
    }`}
  >
    {children}
  </Link>
);
