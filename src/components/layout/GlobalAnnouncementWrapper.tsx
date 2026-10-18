"use client";

import dynamic from "next/dynamic";

// Defer GlobalAnnouncement loading to client-only to avoid Firebase SSR crash
const GlobalAnnouncementClient = dynamic(
  () => import("@/components/layout/GlobalAnnouncement"),
  { ssr: false }
);

export default function GlobalAnnouncementWrapper() {
  return <GlobalAnnouncementClient />;
}
