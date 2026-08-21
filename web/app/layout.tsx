import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Carbon Property Tables",
  description: "Citation-backed carbon-material property figures and performance benchmarking."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
