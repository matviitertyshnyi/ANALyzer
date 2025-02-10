// anal_front/app/layout.tsx
import "../styles/globals.css";
import Header from "../components/Header";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#121212] text-white min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 p-6 w-full container-full">
          {children}
        </main>
        <footer className="bg-[#121212] text-gray-400 p-4 text-center">
          © 2025 Futures Dashboard
        </footer>
      </body>
    </html>
  );
}
