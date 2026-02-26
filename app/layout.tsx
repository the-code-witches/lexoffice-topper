import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lexoffice Topper",
  description: "GbR financial overview",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        <nav className="border-b border-gray-800 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-8">
            <span className="font-semibold text-white">Lexoffice Topper</span>
            <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
              Gesamt
            </Link>
            <Link href="/monthly" className="text-sm text-gray-400 hover:text-white transition-colors">
              Monatlich
            </Link>
            <Link href="/categorize" className="text-sm text-gray-400 hover:text-white transition-colors">
              Kategorisieren
            </Link>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
