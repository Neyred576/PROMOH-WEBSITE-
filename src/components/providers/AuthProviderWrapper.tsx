"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// Defer AuthProvider (and its Firebase dependency) to client-only
const AuthProviderClient = dynamic(
  () => import("@/lib/contexts/AuthContext").then((m) => ({ default: m.AuthProvider })),
  { ssr: false, loading: () => null }
);

export default function AuthProviderWrapper({ children }: { children: ReactNode }) {
  return <AuthProviderClient>{children}</AuthProviderClient>;
}
