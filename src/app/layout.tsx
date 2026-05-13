import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import "@/app/globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo"
});

export const metadata: Metadata = {
  title: "Jusic Nexus — מרכז פיקוד חכם",
  description: "מערכת שירות, CRM ותובנות תפעול — Jusic Nexus Command Center",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Jusic Nexus",
    statusBarStyle: "default"
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/jusic-logo.png", type: "image/png", sizes: "1024x1024" }
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#5a5ac9"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} font-sans`}>
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
