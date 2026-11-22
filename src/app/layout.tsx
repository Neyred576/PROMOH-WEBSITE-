import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import GlobalAnnouncementWrapper from "@/components/layout/GlobalAnnouncementWrapper";
import AuthProviderWrapper from "@/components/providers/AuthProviderWrapper";
import RealtimeNotificationListener from "@/components/layout/RealtimeNotificationListener";
import BackToTop from "@/components/ui/BackToTop";
import MobileBottomNav from "@/components/layout/MobileBottomNav";

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
  title: "Promoh | Find Trusted Professionals Anywhere",
  description: "The most trusted global marketplace for finding and booking verified service professionals.",
  openGraph: {
    title: "Promoh | Trusted Professionals",
    description: "Book verified service professionals instantly.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Promoh",
    description: "Book verified service professionals instantly.",
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
      <body className="min-h-full flex flex-col font-sans text-foreground bg-background">
        <GlobalAnnouncementWrapper />
        <AuthProviderWrapper>
          <RealtimeNotificationListener />
          {children}
          <BackToTop />
          <MobileBottomNav />
        </AuthProviderWrapper>
      </body>
    </html>
  );
}
