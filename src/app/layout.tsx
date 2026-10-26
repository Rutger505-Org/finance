// Validate environment on every page
import "@/env";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { type ReactNode } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Financiën",
  description: "Vaste lasten, overboekingen en vrij besteedbaar geld",
};

const links = [
  { href: "/", label: "Overzicht" },
  { href: "/posten", label: "Posten" },
  { href: "/saldo", label: "Saldo" },
  { href: "/json", label: "JSON" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-muted/40 antialiased`}>
        <header className="border-b bg-background">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="font-semibold">
              Financiën
            </Link>
            <div className="flex flex-wrap gap-4 text-sm">
              {links.map((link) => (
                <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground">
                  {link.label}
                </Link>
              ))}
              <a href="/api/v1/openapi.json" className="text-muted-foreground hover:text-foreground">
                API
              </a>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
