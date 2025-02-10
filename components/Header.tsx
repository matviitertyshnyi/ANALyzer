// anal_front/components/Header.tsx
import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-[#151822] shadow-md p-4 flex items-center justify-between border-b border-gray-700">
      <div className="flex items-center">
        <span className="text-2xl font-bold text-white">Futures Dashboard</span>
      </div>
      <nav>
        <ul className="flex space-x-6 text-lg">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/markets">Markets</Link>
          </li>
          <li>
            <Link href="/trade">Trade</Link>
          </li>
        </ul>
      </nav>
      <div className="flex space-x-3">
        <button className="px-4 py-2 border border-gray-600 rounded hover:bg-gray-700 text-white">
          Login
        </button>
        <button className="px-4 py-2 border border-gray-600 rounded hover:bg-gray-700 text-white">
          Register
        </button>
      </div>
    </header>
  );
}
