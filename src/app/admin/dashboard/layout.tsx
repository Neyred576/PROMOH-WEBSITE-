"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Settings,
  LogOut,
  Globe,
  FileText,
  AlertTriangle,
  CreditCard,
  MessageSquare,
  Bell,
  Ticket,
  ShieldAlert,
  Star,
  Activity,
  Sliders,
  Menu,
  X,
} from "lucide-react";
import Image from "next/image";
import { auth, db } from "@/lib/firebase/client";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const currentTab = searchParams.get("tab") || "overview";
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    try {
      const q = query(collection(db, "providers"), where("status", "==", "Pending"));
      const unsub = onSnapshot(q, (snap) => {
        setPendingCount(snap.size);
      }, () => {});
      return () => unsub();
    } catch {
      // Ignore if firestore not yet created
    }
  }, []);

  const navItems = [
    { href: "/admin/dashboard?tab=overview", icon: <LayoutDashboard className="w-4 h-4" />, label: "Control Center", tabKey: "overview" },
    { href: "/admin/dashboard?tab=analytics", icon: <Activity className="w-4 h-4" />, label: "Live Analytics", tabKey: "analytics" },
    { href: "/admin/dashboard?tab=bookings", icon: <FileText className="w-4 h-4" />, label: "Bookings & Pipeline", tabKey: "bookings" },
    { href: "/admin/dashboard?tab=disputes", icon: <AlertTriangle className="w-4 h-4" />, label: "Dispute Center", tabKey: "disputes" },
    { href: "/admin/dashboard?tab=payouts", icon: <CreditCard className="w-4 h-4" />, label: "Payouts Ledger", tabKey: "payouts" },
    { href: "/admin/dashboard?tab=messages", icon: <MessageSquare className="w-4 h-4" />, label: "Support Chat", tabKey: "messages" },
    { href: "/admin/dashboard?tab=notifications", icon: <Bell className="w-4 h-4" />, label: "Push Broadcast", tabKey: "notifications" },
    { href: "/admin/dashboard?tab=promocodes", icon: <Ticket className="w-4 h-4" />, label: "Promo Codes", tabKey: "promocodes" },
    { href: "/admin/dashboard?tab=providers", icon: <UserCheck className="w-4 h-4" />, label: "Providers & Approvals", tabKey: "providers" },
    { href: "/admin/dashboard?tab=customers", icon: <Users className="w-4 h-4" />, label: "Customers", tabKey: "customers" },
    { href: "/admin/dashboard?tab=reviews", icon: <Star className="w-4 h-4" />, label: "Review Moderation", tabKey: "reviews" },
    { href: "/admin/dashboard?tab=audit", icon: <ShieldAlert className="w-4 h-4" />, label: "Security Audit Trail", tabKey: "audit" },
    { href: "/admin/dashboard?tab=operations", icon: <Sliders className="w-4 h-4" />, label: "Platform Rules", tabKey: "operations" },
    { href: "/admin/dashboard?tab=categories", icon: <Settings className="w-4 h-4" />, label: "Categories", tabKey: "categories" },
    { href: "/admin/dashboard?tab=homepage CMS", icon: <Globe className="w-4 h-4" />, label: "Homepage CMS", tabKey: "homepage CMS" },
    { href: "/admin/dashboard/digital-requests", icon: <FileText className="w-4 h-4" />, label: "Digital Requests", tabKey: "digital-requests" },
  ];

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {navItems.map((item) => {
        const isActive =
          pathname === "/admin/dashboard/digital-requests"
            ? item.tabKey === "digital-requests"
            : currentTab === item.tabKey;

        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={() => onNavigate?.()}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-xs font-semibold ${
              isActive
                ? "bg-primary-50 text-primary-700 shadow-2xs font-bold"
                : "text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900"
            }`}
          >
            <span className={isActive ? "text-primary-600" : "text-secondary-400"}>
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
            {item.tabKey === "providers" && pendingCount > 0 && (
              <span className="ml-auto px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse shrink-0">
                {pendingCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const session = getCookie("admin_session");
      if (session === "authenticated" && user?.email === "admin@promoh.com") {
        setAuthorized(true);
      } else {
        document.cookie = "admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        setAuthorized(false);
        router.replace("/admin/login");
      }
    });
    return () => unsub();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {}
    document.cookie = "admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    router.push("/admin/login");
  };

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white text-secondary-900 border-b md:border-b-0 md:border-r border-secondary-200 flex flex-col shadow-xs z-30 md:min-h-screen md:max-h-screen sticky top-0">
        <div className="h-14 sm:h-16 flex items-center px-4 sm:px-5 border-b border-secondary-200 justify-between">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Promoh Logo" width={28} height={28} className="object-contain" />
            <span className="text-base sm:text-lg font-bold tracking-tight text-primary-600">Promoh Admin</span>
          </Link>
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Collapsible content on mobile, permanent on desktop */}
        <div className={`${mobileMenuOpen ? "flex" : "hidden md:flex"} flex-col flex-1 max-h-[calc(100vh-4rem)] md:max-h-none overflow-y-auto`}>
          <Suspense fallback={<div className="p-4 text-xs text-secondary-400">Loading navigation...</div>}>
            <AdminNav onNavigate={() => setMobileMenuOpen(false)} />
          </Suspense>

          <div className="p-3 border-t border-secondary-200 bg-secondary-50/50 mt-auto">
            <div className="px-3 py-1 mb-1">
              <p className="text-[10px] text-primary-600 font-bold uppercase tracking-wider">Super Administrator</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 px-3 py-2 w-full rounded-xl hover:bg-rose-50 text-secondary-600 hover:text-rose-600 transition-colors text-left text-xs font-semibold"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50/30">
        {children}
      </main>
    </div>
  );
}
