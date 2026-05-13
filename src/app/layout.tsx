import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "@/app/globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo"
});

export const metadata: Metadata = {
  title: "Jusic Nexus — מרכז פיקוד חכם",
  description: "מערכת שירות, CRM ותובנות תפעול — Jusic Nexus Command Center"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} font-sans`}>{children}</body>
    </html>
  );
}
