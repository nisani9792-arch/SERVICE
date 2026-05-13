import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import "@/app/globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo"
});

export const metadata: Metadata = {
  title: "SERVICE — מרכז פניות",
  description: "מערכת SERVICE לניהול פניות, סיווג ותפעול",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SERVICE",
    statusBarStyle: "default"
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "1024x1024" },
      { url: "/jusic-logo.png", type: "image/png", sizes: "1024x1024" }
    ],
    shortcut: "/favicon.png",
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
