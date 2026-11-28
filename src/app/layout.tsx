import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import GlobalAnnouncementWrapper from "@/components/layout/GlobalAnnouncementWrapper";
import AuthProviderWrapper from "@/components/providers/AuthProviderWrapper";
import RealtimeNotificationListener from "@/components/layout/RealtimeNotificationListener";
import BackToTop from "@/components/ui/BackToTop";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import LiveActivityTicker from "@/components/layout/LiveActivityTicker";
import LiveSupportWidget from "@/components/support/LiveSupportWidget";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://promohbusiness.netlify.app"),
  title: "Promoh | Find Trusted Professionals Anywhere",
  description: "The most trusted global marketplace for finding and booking verified service professionals.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Promoh | Trusted Professionals",
    description: "Book verified service professionals instantly.",
    type: "website",
    images: [{ url: "/logo.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Promoh",
    description: "Book verified service professionals instantly.",
    images: ["/logo.png"],
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans text-foreground bg-background pb-16 md:pb-0">
        <GlobalAnnouncementWrapper />
        <AuthProviderWrapper>
          <RealtimeNotificationListener />
          {children}
          <LiveActivityTicker />
          <LiveSupportWidget />
          <BackToTop />
          <MobileBottomNav />
        </AuthProviderWrapper>
      </body>
    </html>
  );
}
