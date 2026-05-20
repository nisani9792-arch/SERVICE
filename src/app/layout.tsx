import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { AccessGate } from "@/components/AccessGate";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { AppBackground } from "@/components/ui/AppBackground";
import "@/app/globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  weight: ["400", "500", "600", "700", "800"]
});

export const metadata: Metadata = {
  title: "JUSIC — מרכז פניות",
  description: "מערכת JUSIC לניהול פניות, סיווג ותפעול",
  manifest: "/manifest.webmanifest",
  other: {
    "mobile-web-app-capable": "yes"
  },
  appleWebApp: {
    capable: true,
    title: "JUSIC",
    statusBarStyle: "default"
  },
  icons: {
    icon: [{ url: "/jusic-logo.png", type: "image/png", sizes: "1024x1024" }],
    shortcut: "/jusic-logo.png",
    apple: "/jusic-logo.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6d5ce8"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} font-sans`}>
        <AppBackground />
        <AccessGate>{children}</AccessGate>
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
