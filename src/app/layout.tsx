import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "@/app/globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo"
});

export const metadata: Metadata = {
  title: "Jusic CRM",
  description: "מערכת שירות לקוחות - Jusic Ticketing & CRM"
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
