import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CNT Property Atlas",
  description: "Interactive carbon nanotube property explorer for literature-backed comparison."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
