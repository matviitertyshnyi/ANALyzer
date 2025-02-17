import Link from 'next/link';

export const Navigation = () => {
  return (
    <nav className="bg-[#1B1B29] p-4">
      <div className="flex space-x-4">
        <Link href="/" className="text-white hover:text-blue-400">
          Dashboard
        </Link>
        <Link href="/ml" className="text-white hover:text-blue-400">
          ML Metrics
        </Link>
        <Link href="/training" className="text-white hover:text-blue-400 font-bold">
          Training
        </Link>
      </div>
    </nav>
  );
};
