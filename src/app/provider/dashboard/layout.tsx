"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { LayoutDashboard, User, CheckCircle, LogOut, ExternalLink } from "lucide-react";
import Image from "next/image";

export default function ProviderDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/provider/login");
      } else if (user.role !== "provider" && user.role !== "admin") {
        router.push("/login");
      }
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const navItems = [
    { href: "/provider/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/provider/dashboard/profile", label: "Business Profile", icon: User },
    { href: "/provider/dashboard/verification", label: "Verification Center", icon: CheckCircle },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-secondary-200 text-secondary-900 flex flex-col shadow-sm">
        <div className="h-20 flex items-center px-6 border-b border-secondary-200 justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Promoh Logo" width={32} height={32} className="object-contain" />
            <span className="text-xl font-bold tracking-tight text-primary-600">Provider</span>
          </Link>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                  isActive
                    ? "bg-primary-600 text-white shadow-sm shadow-primary-500/20 font-semibold"
                    : "text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-secondary-400"}`} />
                {item.label}
              </Link>
            );
          })}

          {user?.uid && (
            <Link
              href={`/provider/${user.uid}`}
              target="_blank"
              className="flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm text-primary-700 bg-primary-50/60 hover:bg-primary-100/60 transition-colors mt-4 border border-primary-100"
            >
              <span className="flex items-center gap-3">
                <ExternalLink className="w-5 h-5 text-primary-600" />
                Public Page
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-white text-primary-700 px-2 py-0.5 rounded-full border border-primary-200 shadow-xs">
                Live
              </span>
            </Link>
          )}
        </nav>
        <div className="p-4 border-t border-secondary-200">
          <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-3 w-full rounded-xl hover:bg-red-50 text-secondary-600 hover:text-red-600 transition-colors text-left text-sm font-medium">
            <LogOut className="w-5 h-5 text-secondary-400 hover:text-red-500" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
