import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RideSense",
    template: "%s | RideSense"
  },
  description: "Finn gode tidspunkt og ruter for sykling basert på værdata i Norge.",
  applicationName: "RideSense",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RideSense"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020b23"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nb" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
        <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 pb-8 pt-4 text-xs text-slate-500">
          <span>RideSense</span>
          <Link href="/privacy" className="hover:text-slate-300">
            Personvern
          </Link>
          <Link href="/support" className="hover:text-slate-300">
            Support
          </Link>
        </footer>
      </body>
    </html>
  );
}
