import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { AccessGate } from "@/components/AccessGate";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { AppBackground } from "@/components/ui/AppBackground";
import { APP_DESCRIPTION, APP_LOGO_SRC, APP_NAME } from "@/lib/brand";
import "@/app/globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  weight: ["400", "500", "600", "700", "800"]
});

export const metadata: Metadata = {
  title: `${APP_NAME} — מרכז פניות`,
  description: APP_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  other: {
    "mobile-web-app-capable": "yes"
  },
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default"
  },
  icons: {
    icon: [{ url: APP_LOGO_SRC, type: "image/png", sizes: "1024x1024" }],
    shortcut: APP_LOGO_SRC,
    apple: APP_LOGO_SRC
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2fb4d8"
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
