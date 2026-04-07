import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RideSense",
  description: "Finn beste sykkeltidspunkt basert på værdata i Norge."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nb">
      <body>{children}</body>
    </html>
  );
}
