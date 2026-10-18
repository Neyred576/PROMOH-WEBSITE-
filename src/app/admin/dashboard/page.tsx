"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { db } from "@/lib/firebase/client";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  Users,
  Briefcase,
  Clock,
  Activity,
  CheckCircle,
  XCircle,
  Star,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  AlertTriangle,
  Plus,
  LayoutDashboard,
  Key,
  Calendar,
  Flag,
  ShieldAlert,
  Ban,
  Wifi,
  WifiOff,
  X,
  Edit2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Search,
  DollarSign,
  TrendingUp,
  FileText,
  CreditCard,
  MapPin,
  Check,
  EyeOff,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currencies";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

/** Safely converts a Firestore Timestamp, ISO string, or Date to a JS timestamp (ms). */
function toMs(val: unknown): number {
  if (!val) return 0;
  if (val instanceof Timestamp) return val.toMillis();
  if (val instanceof Date) return val.getTime();
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  if (typeof val === "object" && "seconds" in (val as object)) {
    return (val as { seconds: number }).seconds * 1000;
  }
  return 0;
}

/** Formats any Firestore date value to a human-readable string. */
function fmtDate(val: unknown): string {
  const ms = toMs(val);
  if (!ms) return "—";
  return new Date(ms).toLocaleString();
}

interface Toast {
  id: string;
  type: "success" | "info" | "warning";
  message: string;
}

interface Provider {
  id: string;
  businessName: string;
  firstName: string;
  lastName: string;
  email: string;
  servicesOffered: string;
  location: string;
  status: string;
  isVerified: boolean;
  isFeatured: boolean;
  isOnline?: boolean;
  banned?: boolean;
  verificationDocumentUrl?: string;
  createdAt: string;
  rating?: number;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  country?: string;
  role?: string;
  isOnline?: boolean;
  banned?: boolean;
  createdAt: string;
}

interface CategoryItem {
  id?: string;
  name: string;
  slug: string;
  hidden?: boolean;
}

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState("overview");

  // Real-time data lists
  const [allProviders, setAllProviders] = useState<Provider[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [allReports, setAllReports] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  // Platform settings & CMS
  const [platformSettings, setPlatformSettings] = useState({
    popularCategories: [] as string[],
    emergencyServices: [] as { name: string; slug: string }[],
    exploreCategories: [] as { name: string; slug: string }[],
    categories: [] as CategoryItem[],
    announcement: { message: "", isActive: false },
  });

  // Inputs for adding new CMS items
  const [newPopular, setNewPopular] = useState("");
  const [newEmergency, setNewEmergency] = useState({ name: "", slug: "" });
  const [newExplore, setNewExplore] = useState({ name: "", slug: "" });
  const [newCategory, setNewCategory] = useState({ name: "", slug: "" });

  // Announcement state
  const [announcementMsg, setAnnouncementMsg] = useState("");
  const [announcementActive, setAnnouncementActive] = useState(false);

  // Edit Modals / Popups
  const [editingItem, setEditingItem] = useState<{
    type: "popular" | "emergency" | "explore" | "category";
    index: number;
    name: string;
    slug?: string;
  } | null>(null);

  // Search & Filter States
  const [providerSearch, setProviderSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<"all" | "pending" | "approved" | "featured" | "banned">("all");

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState<"all" | "online" | "banned">("all");

  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingFilter, setBookingFilter] = useState<"all" | "pending" | "active" | "completed" | "cancelled">("all");
  const [selectedBookingDetails, setSelectedBookingDetails] = useState<any | null>(null);

  const [reportFilter, setReportFilter] = useState<"all" | "open" | "resolved">("all");

  // Real-time toasts & connectivity
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  // Track previous counts to detect incoming notifications
  const prevProviderCount = useRef<number | null>(null);
  const prevCustomerCount = useRef<number | null>(null);
  const prevBookingCount = useRef<number | null>(null);

  const pushToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3500);
  };

  // Real-time listeners
  useEffect(() => {
    // 1. Listen to users (Customers)
    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snap) => {
        setIsOnline(true);
        const customersList: Customer[] = [];

        snap.docs.forEach((d) => {
          const data = d.data();
          // Any user that is not a provider is treated as a customer
          if (data.role !== "provider" && data.role !== "admin") {
            customersList.push({ id: d.id, ...data } as Customer);
          }
        });

        // Toast on new customer
        if (prevCustomerCount.current !== null && customersList.length > prevCustomerCount.current) {
          pushToast(`🙋 New customer registered!`, "info");
        }
        prevCustomerCount.current = customersList.length;

        customersList.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
        setAllCustomers(customersList);
        setLoadingCustomers(false);
      },
      () => setIsOnline(false)
    );

    // 2. Listen to providers
    const unsubProviders = onSnapshot(
      collection(db, "providers"),
      (snap) => {
        setIsOnline(true);
        const providers = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Provider));

        // Toast on new provider
        if (prevProviderCount.current !== null && providers.length > prevProviderCount.current) {
          pushToast(`🏢 New provider applied — review pending!`, "warning");
        }
        prevProviderCount.current = providers.length;

        providers.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
        setAllProviders(providers);
        setLoadingProviders(false);
      },
      () => setIsOnline(false)
    );

    // 3. Listen to bookings
    const unsubBookings = onSnapshot(
      collection(db, "bookings"),
      (snap) => {
        setIsOnline(true);
        const bookings: any[] = [];
        let revenue = 0;

        snap.docs.forEach((d) => {
          const data = d.data();
          bookings.push({ id: d.id, ...data });
          if (data.status === "completed") {
            revenue += Number(data.amount || 0);
          }
        });

        bookings.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

        // Toast on new booking
        if (prevBookingCount.current !== null && bookings.length > prevBookingCount.current) {
          pushToast(`📅 New booking created on platform!`, "success");
        }
        prevBookingCount.current = bookings.length;

        setAllBookings(bookings);
        setTotalRevenue(revenue);
      },
      () => setIsOnline(false)
    );

    // 4. Listen to reports
    const unsubReports = onSnapshot(
      collection(db, "reports"),
      (snap) => {
        setIsOnline(true);
        const reports = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        reports.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
        setAllReports(reports);
      },
      () => setIsOnline(false)
    );

    return () => {
      unsubUsers();
      unsubProviders();
      unsubBookings();
      unsubReports();
    };
  }, [pushToast]);

  // Real-time listener for homepage & CMS settings
  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, "platform_settings", "homepage"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fallbackCategories = [
          { name: "Electricians", slug: "Electricians" },
          { name: "Plumbers", slug: "Plumbers" },
          { name: "Cleaners", slug: "Cleaners" },
          { name: "Tutors", slug: "Tutors" },
          { name: "Photographers", slug: "Photographers" },
          { name: "Mechanics", slug: "Mechanics" },
          { name: "Carpenters", slug: "Carpenters" },
          { name: "Painters", slug: "Painters" },
          { name: "Movers", slug: "Movers" },
          { name: "Beauty Professionals", slug: "Beauty" },
          { name: "IT Specialists", slug: "IT" },
          { name: "Home Repair", slug: "HomeRepair" },
        ];

        setPlatformSettings((prev) => ({
          ...prev,
          popularCategories: data.popularCategories || ["Electricians", "Plumbers", "Cleaners", "Home Repair"],
          emergencyServices: data.emergencyServices || [
            { name: "24/7 Plumber", slug: "Plumbers" },
            { name: "Emergency Electrician", slug: "Electricians" },
          ],
          exploreCategories: data.exploreCategories || fallbackCategories,
          categories: data.categories || fallbackCategories,
        }));
      } else {
        // Initialize default categories in Firestore if document doesn't exist
        const initialExplore = [
          { name: "Electricians", slug: "Electricians" },
          { name: "Plumbers", slug: "Plumbers" },
          { name: "Cleaners", slug: "Cleaners" },
          { name: "Tutors", slug: "Tutors" },
          { name: "Photographers", slug: "Photographers" },
          { name: "Mechanics", slug: "Mechanics" },
          { name: "Carpenters", slug: "Carpenters" },
          { name: "Painters", slug: "Painters" },
          { name: "Movers", slug: "Movers" },
          { name: "Beauty Professionals", slug: "Beauty" },
          { name: "IT Specialists", slug: "IT" },
          { name: "Home Repair", slug: "HomeRepair" },
        ];
        setDoc(doc(db, "platform_settings", "homepage"), {
          popularCategories: ["Electricians", "Plumbers", "Cleaners", "Home Repair"],
          emergencyServices: [
            { name: "24/7 Plumber", slug: "Plumbers" },
            { name: "Emergency Electrician", slug: "Electricians" },
          ],
          exploreCategories: initialExplore,
          categories: initialExplore,
        }).catch(() => {});
      }
    });

    const unsubAnnouncements = onSnapshot(doc(db, "platform_settings", "announcements"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPlatformSettings((prev) => ({
          ...prev,
          announcement: { message: data.message || "", isActive: data.isActive || false },
        }));
        setAnnouncementMsg(data.message || "");
        setAnnouncementActive(data.isActive || false);
      }
    });

    return () => {
      unsubSettings();
      unsubAnnouncements();
    };
  }, []);

  // Update Firestore Settings
  const updateSettings = async (updates: any) => {
    try {
      await updateDoc(doc(db, "platform_settings", "homepage"), updates);
      showMsg("Settings updated successfully and live on the homepage!");
    } catch (e) {
      await setDoc(doc(db, "platform_settings", "homepage"), updates, { merge: true });
      showMsg("Settings saved and live on homepage!");
    }
  };

  // Provider Actions
  const approveProvider = async (id: string) => {
    setActionLoading(id + "_approve");
    try {
      await updateDoc(doc(db, "providers", id), { status: "Approved", isVerified: true });
      await updateDoc(doc(db, "users", id), { isVerified: true }).catch(() => {});

      await addDoc(collection(db, "notifications"), {
        userId: id,
        title: "Account Approved!",
        message: "Your provider account has been verified and approved. You are now live on the platform.",
        link: "/provider/dashboard",
        read: false,
        createdAt: serverTimestamp(),
      });

      showMsg("✅ Provider approved and verified!");
    } catch (e) {
      showMsg("Error approving provider.");
    } finally {
      setActionLoading(null);
    }
  };

  const rejectProvider = async (id: string) => {
    setActionLoading(id + "_reject");
    try {
      await updateDoc(doc(db, "providers", id), { status: "Rejected", isVerified: false });

      await addDoc(collection(db, "notifications"), {
        userId: id,
        title: "Account Update",
        message: "Your provider account application was rejected. Please contact support for details.",
        link: "/provider/dashboard",
        read: false,
        createdAt: serverTimestamp(),
      });

      showMsg("Provider application rejected.");
    } catch (e) {
      showMsg("Error rejecting provider.");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    setActionLoading(id + "_feature");
    try {
      await updateDoc(doc(db, "providers", id), { isFeatured: !current });
      showMsg(current ? "Removed from homepage." : "⭐ Featured on homepage!");
    } catch (e) {
      showMsg("Error updating featured status.");
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (id: string, collection_name: string) => {
    if (!confirm("Are you sure? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, collection_name, id));
      if (collection_name === "providers") {
        await deleteDoc(doc(db, "users", id)).catch(() => {});
      }
      showMsg("Account permanently deleted.");
    } catch (e) {
      showMsg("Error deleting account.");
    }
  };

  const toggleBanUser = async (id: string, collection_name: string, isBanned: boolean) => {
    try {
      const newBannedState = !isBanned;
      await updateDoc(doc(db, collection_name, id), { banned: newBannedState });
      if (collection_name === "providers") {
        await updateDoc(doc(db, "users", id), { banned: newBannedState }).catch(() => {});
      }
      showMsg(newBannedState ? "User has been banned." : "User has been unbanned.");
    } catch (e) {
      showMsg("Error updating ban status.");
    }
  };

  const resolveReport = async (reportId: string, action: "dismiss" | "ban", targetId: string, targetType: string) => {
    try {
      await updateDoc(doc(db, "reports", reportId), {
        status: "resolved",
        resolution: action,
        resolvedAt: new Date().toISOString(),
      });
      if (action === "ban") {
        await toggleBanUser(targetId, targetType === "provider" ? "providers" : "users", false);
      }
      showMsg(`Report resolved (${action})`);
    } catch (err) {
      showMsg("Error resolving report.");
    }
  };

  const viewCredentials = async (id: string, name: string) => {
    try {
      const docSnap = await getDoc(doc(db, "support_credentials", id));
      if (docSnap.exists()) {
        const data = docSnap.data();
        alert(
          `Support Credentials for ${name}:\n\nEmail: ${data.email}\nPhone: ${data.phone || "N/A"}\nPassword Hint: ${
            data.passwordHint
          }\nLength: ${data.passwordLength} chars`
        );
      } else {
        alert("No support credentials found for this provider (registered before support credentials feature).");
      }
    } catch (e) {
      alert("Error fetching credentials.");
    }
  };

  // CMS Announcement Actions
  const updateAnnouncement = async () => {
    try {
      await setDoc(doc(db, "platform_settings", "announcements"), {
        message: announcementMsg,
        isActive: announcementActive,
        updatedAt: new Date().toISOString(),
      });
      showMsg("Global announcement saved and live!");
    } catch (e) {
      showMsg("Error updating announcement.");
    }
  };

  const removeAnnouncement = async () => {
    if (!confirm("Are you sure you want to remove and clear the active announcement banner?")) return;
    try {
      await setDoc(doc(db, "platform_settings", "announcements"), {
        message: "",
        isActive: false,
        updatedAt: new Date().toISOString(),
      });
      setAnnouncementMsg("");
      setAnnouncementActive(false);
      showMsg("Announcement banner removed.");
    } catch (e) {
      showMsg("Error removing announcement.");
    }
  };

  // CMS Popular Categories Actions
  const addPopularCat = () => {
    if (!newPopular.trim()) return;
    const updated = [...platformSettings.popularCategories, newPopular.trim()];
    updateSettings({ popularCategories: updated });
    setNewPopular("");
  };

  const removePopularCat = (cat: string) => {
    const updated = platformSettings.popularCategories.filter((c) => c !== cat);
    updateSettings({ popularCategories: updated });
  };

  // CMS Emergency Services Actions
  const addEmergencyService = () => {
    if (!newEmergency.name.trim() || !newEmergency.slug.trim()) return;
    const updated = [...platformSettings.emergencyServices, { name: newEmergency.name.trim(), slug: newEmergency.slug.trim() }];
    updateSettings({ emergencyServices: updated });
    setNewEmergency({ name: "", slug: "" });
  };

  const removeEmergencyService = (name: string) => {
    const updated = platformSettings.emergencyServices.filter((s) => s.name !== name);
    updateSettings({ emergencyServices: updated });
  };

  // CMS Explore Categories Grid Actions
  const addExploreCategory = () => {
    if (!newExplore.name.trim() || !newExplore.slug.trim()) return;
    const updated = [...platformSettings.exploreCategories, { name: newExplore.name.trim(), slug: newExplore.slug.trim() }];
    updateSettings({ exploreCategories: updated });
    setNewExplore({ name: "", slug: "" });
  };

  const removeExploreCategory = (name: string) => {
    const updated = platformSettings.exploreCategories.filter((s) => s.name !== name);
    updateSettings({ exploreCategories: updated });
  };

  const moveExploreCategory = (index: number, direction: -1 | 1) => {
    const newCategories = [...platformSettings.exploreCategories];
    if (index + direction < 0 || index + direction >= newCategories.length) return;
    const temp = newCategories[index];
    newCategories[index] = newCategories[index + direction];
    newCategories[index + direction] = temp;
    updateSettings({ exploreCategories: newCategories });
  };

  // Manage Categories Tab Actions
  const addMasterCategory = () => {
    if (!newCategory.name.trim()) return;
    const slug = newCategory.slug.trim() || newCategory.name.trim();
    const updated = [...platformSettings.categories, { name: newCategory.name.trim(), slug, hidden: false }];
    updateSettings({ categories: updated });
    setNewCategory({ name: "", slug: "" });
  };

  const toggleHideMasterCategory = (index: number) => {
    const updated = [...platformSettings.categories];
    updated[index].hidden = !updated[index].hidden;
    updateSettings({ categories: updated });
  };

  const moveMasterCategory = (index: number, direction: -1 | 1) => {
    const updated = [...platformSettings.categories];
    if (index + direction < 0 || index + direction >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[index + direction];
    updated[index + direction] = temp;
    updateSettings({ categories: updated });
  };

  const removeMasterCategory = (index: number) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    const updated = platformSettings.categories.filter((_, i) => i !== index);
    updateSettings({ categories: updated });
  };

  // Save Edit Handler for Modals
  const handleSaveEdit = () => {
    if (!editingItem) return;

    if (editingItem.type === "popular") {
      const updated = [...platformSettings.popularCategories];
      updated[editingItem.index] = editingItem.name;
      updateSettings({ popularCategories: updated });
    } else if (editingItem.type === "emergency") {
      const updated = [...platformSettings.emergencyServices];
      updated[editingItem.index] = { name: editingItem.name, slug: editingItem.slug || editingItem.name };
      updateSettings({ emergencyServices: updated });
    } else if (editingItem.type === "explore") {
      const updated = [...platformSettings.exploreCategories];
      updated[editingItem.index] = { name: editingItem.name, slug: editingItem.slug || editingItem.name };
      updateSettings({ exploreCategories: updated });
    } else if (editingItem.type === "category") {
      const updated = [...platformSettings.categories];
      updated[editingItem.index] = {
        ...updated[editingItem.index],
        name: editingItem.name,
        slug: editingItem.slug || editingItem.name,
      };
      updateSettings({ categories: updated });
    }

    setEditingItem(null);
  };

  // Computed Real-Time Stats
  const onlineCustomersCount = useMemo(
    () => allCustomers.filter((c) => c.isOnline).length,
    [allCustomers]
  );
  const onlineProvidersCount = useMemo(
    () => allProviders.filter((p) => p.isOnline).length,
    [allProviders]
  );
  const pendingProviders = useMemo(
    () => allProviders.filter((p) => p.status === "Pending"),
    [allProviders]
  );
  const approvedProvidersCount = useMemo(
    () => allProviders.filter((p) => p.status === "Approved").length,
    [allProviders]
  );

  // Today counts
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const todayCustomersCount = useMemo(
    () => allCustomers.filter((c) => toMs(c.createdAt) >= todayMs).length,
    [allCustomers, todayMs]
  );
  const todayBookingsCount = useMemo(
    () => allBookings.filter((b) => toMs(b.createdAt) >= todayMs).length,
    [allBookings, todayMs]
  );

  // Filtered Providers
  const filteredProviders = useMemo(() => {
    return allProviders.filter((p) => {
      if (providerFilter === "pending" && p.status !== "Pending") return false;
      if (providerFilter === "approved" && p.status !== "Approved") return false;
      if (providerFilter === "featured" && !p.isFeatured) return false;
      if (providerFilter === "banned" && !p.banned) return false;

      if (!providerSearch.trim()) return true;
      const q = providerSearch.toLowerCase();
      return (
        p.businessName?.toLowerCase().includes(q) ||
        p.firstName?.toLowerCase().includes(q) ||
        p.lastName?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.servicesOffered?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q)
      );
    });
  }, [allProviders, providerFilter, providerSearch]);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    return allCustomers.filter((c) => {
      if (customerFilter === "online" && !c.isOnline) return false;
      if (customerFilter === "banned" && !c.banned) return false;

      if (!customerSearch.trim()) return true;
      const q = customerSearch.toLowerCase();
      return (
        c.firstName?.toLowerCase().includes(q) ||
        c.lastName?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
      );
    });
  }, [allCustomers, customerFilter, customerSearch]);

  // Filtered Bookings
  const filteredBookings = useMemo(() => {
    return allBookings.filter((b) => {
      if (bookingFilter === "pending" && b.status !== "pending") return false;
      if (bookingFilter === "active" && b.status !== "accepted" && b.status !== "in_progress") return false;
      if (bookingFilter === "completed" && b.status !== "completed") return false;
      if (bookingFilter === "cancelled" && b.status !== "cancelled" && b.status !== "rejected") return false;

      if (!bookingSearch.trim()) return true;
      const q = bookingSearch.toLowerCase();
      return (
        b.customerName?.toLowerCase().includes(q) ||
        b.providerName?.toLowerCase().includes(q) ||
        b.service?.toLowerCase().includes(q) ||
        b.address?.toLowerCase().includes(q) ||
        b.id?.toLowerCase().includes(q)
      );
    });
  }, [allBookings, bookingFilter, bookingSearch]);

  // Filtered Reports
  const filteredReports = useMemo(() => {
    return allReports.filter((r) => {
      if (reportFilter === "open" && r.status !== "open") return false;
      if (reportFilter === "resolved" && r.status === "open") return false;
      return true;
    });
  }, [allReports, reportFilter]);

  // Real Platform Revenue Chart Data (Last 7 Days)
  const revenueChartData = useMemo(() => {
    const days = 7;
    const now = new Date();
    const dateMap = new Map<string, number>();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dateMap.set(key, 0);
    }

    allBookings.forEach((b) => {
      if (b.status === "completed") {
        const rawDate = b.updatedAt || b.date;
        if (!rawDate) return;
        const bookingDate = rawDate.split("T")[0];
        if (dateMap.has(bookingDate)) {
          const amt = Number(b.amount || 0);
          dateMap.set(bookingDate, (dateMap.get(bookingDate) || 0) + amt);
        }
      }
    });

    return Array.from(dateMap.entries()).map(([dateStr, rev]) => {
      const d = new Date(dateStr + "T12:00:00");
      return {
        dateStr,
        label: d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" }),
        revenue: rev,
      };
    });
  }, [allBookings]);

  const openReportsCount = useMemo(() => allReports.filter((r) => r.status === "open").length, [allReports]);

  const TABS = [
    { key: "overview", label: "Overview" },
    { key: "analytics", label: "Analytics" },
    { key: "bookings", label: `Bookings (${allBookings.length})` },
    { key: "providers", label: `All Providers (${allProviders.length})` },
    { key: "customers", label: `All Customers (${allCustomers.length})` },
    { key: "reports", label: `Reports (${openReportsCount})`, alertCount: openReportsCount },
    { key: "categories", label: "Manage Categories" },
    { key: "homepage CMS", label: "Homepage CMS" },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto pb-24 space-y-6">
      {/* Toast Notifications */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium max-w-sm transition-all ${
              t.type === "success"
                ? "bg-green-50 border-green-200 text-green-900"
                : t.type === "warning"
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-blue-50 border-blue-200 text-blue-900"
            }`}
          >
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismissToast(t.id)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-secondary-900">Admin Control Center</h1>
          <p className="text-secondary-500 text-xs sm:text-sm mt-1">
            Real-time platform monitoring, customer records, verification, and live CMS controls.
          </p>
        </div>

        {/* Live Network Status Indicator */}
        <div
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border self-start sm:self-auto ${
            isOnline ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {isOnline ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <Wifi className="w-3.5 h-3.5 text-green-600" />
              Real-Time Feed Live
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-red-600" />
              Connection Paused
            </>
          )}
        </div>
      </div>

      {/* Flash Message */}
      {message && (
        <div className="p-3.5 bg-primary-50 border border-primary-200 text-primary-800 rounded-xl text-xs sm:text-sm font-medium animate-in fade-in flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage("")} className="text-primary-600 hover:text-primary-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Alert Banners */}
      <div className="space-y-3">
        {pendingProviders.length > 0 && (
          <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span className="text-amber-900 text-xs sm:text-sm font-medium">
                {pendingProviders.length} provider application{pendingProviders.length > 1 ? "s" : ""} pending review and approval.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-900 hover:bg-amber-100 text-xs shrink-0"
              onClick={() => {
                setActiveTab("providers");
                setProviderFilter("pending");
              }}
            >
              Review Now
            </Button>
          </div>
        )}

        {openReportsCount > 0 && (
          <div className="flex items-center justify-between p-4 bg-rose-50 border border-rose-200 rounded-xl gap-3">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="text-rose-900 text-xs sm:text-sm font-medium">
                {openReportsCount} unresolved Trust & Safety report{openReportsCount > 1 ? "s" : ""} requiring action.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-rose-300 text-rose-900 hover:bg-rose-100 text-xs shrink-0"
              onClick={() => {
                setActiveTab("reports");
                setReportFilter("open");
              }}
            >
              Review Reports
            </Button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-secondary-200 overflow-x-auto hide-scrollbar gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 sm:px-5 py-3 font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === tab.key
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-secondary-500 hover:text-secondary-900"
            }`}
          >
            {tab.label}
            {tab.alertCount && tab.alertCount > 0 ? (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {tab.alertCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* 1. OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {/* Real-Time Live Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Customers */}
            <Card className="border border-blue-200 bg-blue-50/40 relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm text-blue-600">
                    <Users className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      onlineCustomersCount > 0 ? "bg-green-100 text-green-700" : "bg-secondary-200 text-secondary-600"
                    }`}
                  >
                    {onlineCustomersCount} Online
                  </span>
                </div>
                <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">Total Customers</p>
                <h3 className="text-3xl font-extrabold mt-1 text-secondary-900">{allCustomers.length}</h3>
                <p className="text-[11px] text-blue-700 font-medium mt-1">+{todayCustomersCount} joined today</p>
              </CardContent>
            </Card>

            {/* Providers */}
            <Card className="border border-indigo-200 bg-indigo-50/40 relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm text-indigo-600">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      onlineProvidersCount > 0 ? "bg-green-100 text-green-700" : "bg-secondary-200 text-secondary-600"
                    }`}
                  >
                    {onlineProvidersCount} Online
                  </span>
                </div>
                <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">Total Providers</p>
                <h3 className="text-3xl font-extrabold mt-1 text-secondary-900">{allProviders.length}</h3>
                <p className="text-[11px] text-indigo-700 font-medium mt-1">{approvedProvidersCount} approved & active</p>
              </CardContent>
            </Card>

            {/* Pending Verifications */}
            <Card className="border border-amber-200 bg-amber-50/40 relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm text-amber-600">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-100 text-amber-800">
                    Action Req.
                  </span>
                </div>
                <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">Pending Review</p>
                <h3 className="text-3xl font-extrabold mt-1 text-secondary-900">{pendingProviders.length}</h3>
                <p className="text-[11px] text-amber-700 font-medium mt-1">Waiting for approval</p>
              </CardContent>
            </Card>

            {/* Approved Providers */}
            <Card className="border border-green-200 bg-green-50/40 relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm text-green-600">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-green-100 text-green-800">
                    Verified
                  </span>
                </div>
                <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">Approved Providers</p>
                <h3 className="text-3xl font-extrabold mt-1 text-secondary-900">{approvedProvidersCount}</h3>
                <p className="text-[11px] text-green-700 font-medium mt-1">Live on platform</p>
              </CardContent>
            </Card>
          </div>

          {/* Pending Approvals Quick Panel */}
          <Card className="border-secondary-200/80 shadow-sm">
            <CardHeader className="bg-secondary-50/50 border-b border-secondary-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" /> Pending Provider Applications ({pendingProviders.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Approve verified providers so they can accept bookings and appear in search results.
                  </CardDescription>
                </div>
                {pendingProviders.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setActiveTab("providers");
                      setProviderFilter("pending");
                    }}
                    className="text-xs text-primary-600"
                  >
                    View All in Providers
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {pendingProviders.length === 0 ? (
                <div className="text-center py-8 text-secondary-400 border-2 border-dashed border-secondary-200 rounded-xl text-xs">
                  All provider applications are reviewed! No pending approvals.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingProviders.slice(0, 5).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-4 rounded-xl border border-secondary-200 bg-white flex-wrap gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-secondary-900 text-sm truncate">
                          {p.businessName || `${p.firstName} ${p.lastName}`}
                        </div>
                        <div className="text-xs text-secondary-500">
                          {p.servicesOffered || "General"} &middot; {p.location || "Location not set"} &middot; {p.email}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {p.verificationDocumentUrl && (
                          <Link href={p.verificationDocumentUrl} target="_blank">
                            <Button size="sm" variant="outline" className="text-xs text-blue-600 border-blue-300 hover:bg-blue-50 h-8">
                              <ShieldCheck className="w-3.5 h-3.5 mr-1" /> View ID
                            </Button>
                          </Link>
                        )}
                        <Link href={`/provider/${p.id}`} target="_blank">
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-secondary-500">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-green-700 border-green-300 hover:bg-green-50"
                          isLoading={actionLoading === p.id + "_approve"}
                          onClick={() => approveProvider(p.id)}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-red-600 border-red-300 hover:bg-red-50"
                          isLoading={actionLoading === p.id + "_reject"}
                          onClick={() => rejectProvider(p.id)}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Chronological Activity Stream */}
          <Card className="border-secondary-200/80 shadow-sm">
            <CardHeader className="bg-secondary-50/50 border-b border-secondary-100">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" /> Live Platform Activity Feed
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time chronological events across users, bookings, and provider signups.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 text-xs">
                {[
                  ...allProviders.map((p) => ({ type: "provider", data: p as any, time: toMs(p.createdAt) })),
                  ...allCustomers.map((c) => ({ type: "customer", data: c as any, time: toMs(c.createdAt) })),
                  ...allBookings.map((b) => ({ type: "booking", data: b as any, time: toMs(b.createdAt) })),
                ]
                  .sort((a, b) => b.time - a.time)
                  .slice(0, 15)
                  .map((act, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-xl bg-white border border-secondary-200/80 hover:bg-secondary-50/50 transition-colors"
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          act.type === "provider"
                            ? "bg-indigo-100 text-indigo-700"
                            : act.type === "customer"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {act.type === "provider" ? (
                          <Briefcase className="w-4 h-4" />
                        ) : act.type === "customer" ? (
                          <Users className="w-4 h-4" />
                        ) : (
                          <Calendar className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-secondary-900">
                            {act.type === "provider"
                              ? "New Provider Registered"
                              : act.type === "customer"
                              ? "New Customer Joined"
                              : "New Booking Created"}
                          </p>
                          <span className="text-[11px] text-secondary-400">
                            {act.time ? fmtDate(act.time) : "—"}
                          </span>
                        </div>
                        <p className="text-secondary-600 mt-0.5 truncate">
                          {act.type === "provider"
                            ? `${act.data.businessName || act.data.firstName} signed up for ${act.data.servicesOffered || "services"}.`
                            : act.type === "customer"
                            ? `${act.data.firstName} ${act.data.lastName || ""} registered from ${act.data.country || "online"}.`
                            : `${act.data.customerName} booked ${act.data.service} with ${act.data.providerName}.`}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. ANALYTICS TAB */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Revenue Top Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="border-secondary-200/80 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-green-800">Platform Revenue</span>
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-3xl font-black text-green-950">{formatCurrency(totalRevenue, "USD")}</div>
                <p className="text-xs text-green-700 mt-1">
                  From {allBookings.filter((b) => b.status === "completed").length} completed jobs
                </p>
              </CardContent>
            </Card>

            <Card className="border-secondary-200/80 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-800">Cleared Payments</span>
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-3xl font-black text-blue-950">
                  {formatCurrency(
                    allBookings
                      .filter((b) => b.status === "completed" && b.paymentStatus === "paid")
                      .reduce((sum, b) => sum + Number(b.amount || 0), 0),
                    "USD"
                  )}
                </div>
                <p className="text-xs text-blue-700 mt-1">Settled on Stripe/platform</p>
              </CardContent>
            </Card>

            <Card className="border-secondary-200/80 shadow-sm bg-gradient-to-br from-purple-50 to-pink-50/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-800">Avg Job Ticket</span>
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-3xl font-black text-purple-950">
                  {formatCurrency(
                    allBookings.filter((b) => b.status === "completed").length > 0
                      ? totalRevenue / allBookings.filter((b) => b.status === "completed").length
                      : 0,
                    "USD"
                  )}
                </div>
                <p className="text-xs text-purple-700 mt-1">Average completed booking value</p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Chart */}
          <Card className="border-secondary-200/80 shadow-sm">
            <CardHeader className="bg-secondary-50/50 border-b border-secondary-100">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-600" /> Real Platform Daily Revenue (Last 7 Days)
              </CardTitle>
              <CardDescription className="text-xs">
                Computed live across all completed customer bookings
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="adminRevenueColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(val) => `$${val}`} />
                    <RechartsTooltip
                      contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                      formatter={(val: any) => [formatCurrency(Number(val) || 0, "USD"), "Platform Volume"]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={3} fillOpacity={1} fill="url(#adminRevenueColor)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Booking Status Breakdown */}
          <Card className="border-secondary-200/80 shadow-sm">
            <CardHeader className="bg-secondary-50/50 border-b border-secondary-100">
              <CardTitle className="text-base">Real-Time Booking Status Breakdown</CardTitle>
              <CardDescription className="text-xs">
                Live distribution of all {allBookings.length} bookings created on the marketplace
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center">
                  <div className="text-3xl font-extrabold text-amber-800">
                    {allBookings.filter((b) => b.status === "pending").length}
                  </div>
                  <div className="text-xs text-amber-700 font-semibold uppercase tracking-wider mt-1">Pending</div>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-center">
                  <div className="text-3xl font-extrabold text-blue-800">
                    {allBookings.filter((b) => b.status === "accepted" || b.status === "in_progress").length}
                  </div>
                  <div className="text-xs text-blue-700 font-semibold uppercase tracking-wider mt-1">Accepted / In Progress</div>
                </div>

                <div className="p-4 bg-green-50 rounded-xl border border-green-200 text-center">
                  <div className="text-3xl font-extrabold text-green-800">
                    {allBookings.filter((b) => b.status === "completed").length}
                  </div>
                  <div className="text-xs text-green-700 font-semibold uppercase tracking-wider mt-1">Completed</div>
                </div>

                <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 text-center">
                  <div className="text-3xl font-extrabold text-rose-800">
                    {allBookings.filter((b) => b.status === "cancelled" || b.status === "rejected").length}
                  </div>
                  <div className="text-xs text-rose-700 font-semibold uppercase tracking-wider mt-1">Cancelled / Rejected</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. BOOKINGS TAB */}
      {activeTab === "bookings" && (
        <Card className="border-secondary-200/80 shadow-sm overflow-hidden">
          <CardHeader className="bg-secondary-50/50 border-b border-secondary-100 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <span>Platform Bookings Audit</span>
                  <span className="text-xs font-bold bg-primary-100 text-primary-700 px-2.5 py-0.5 rounded-full">
                    {allBookings.length} Total
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Every service request and appointment placed on the platform in real time
                </CardDescription>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-secondary-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  placeholder="Search by customer, provider..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-secondary-200 text-xs bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 pt-3 overflow-x-auto">
              {(["all", "pending", "active", "completed", "cancelled"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setBookingFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap ${
                    bookingFilter === f ? "bg-secondary-900 text-white" : "text-secondary-600 hover:bg-secondary-100"
                  }`}
                >
                  {f === "active" ? "Accepted / In Progress" : f}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredBookings.length === 0 ? (
              <div className="p-12 text-center text-xs text-secondary-400">
                No bookings match your current filter or search criteria.
              </div>
            ) : (
              <div className="divide-y divide-secondary-100 max-h-[700px] overflow-y-auto">
                {filteredBookings.map((b) => (
                  <div key={b.id} className="p-4 hover:bg-secondary-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-secondary-900 text-sm">{b.service || "Booking"}</span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            b.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : b.status === "pending"
                              ? "bg-amber-100 text-amber-700"
                              : b.status === "accepted" || b.status === "in_progress"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {b.status.replace("_", " ")}
                        </span>
                        {b.paymentStatus === "paid" && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Paid
                          </span>
                        )}
                      </div>

                      <div className="text-secondary-600 flex items-center gap-3 flex-wrap">
                        <span>
                          <strong>Customer:</strong> {b.customerName || "Customer"}
                        </span>
                        <span>&rarr;</span>
                        <span>
                          <strong>Provider:</strong> {b.providerName || "Provider"}
                        </span>
                      </div>

                      <div className="text-secondary-400 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> {b.date} at {b.time}
                        </span>
                        {b.address && (
                          <span className="flex items-center gap-1 truncate max-w-xs">
                            <MapPin className="w-3.5 h-3.5" /> {b.address}
                          </span>
                        )}
                      </div>

                      {b.notes && <div className="text-secondary-500 italic bg-white p-2 rounded-lg border border-secondary-100">"{b.notes}"</div>}
                    </div>

                    <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-base font-extrabold text-secondary-900 block">
                          {formatCurrency(Number(b.amount !== undefined ? b.amount : b.estimatedRate || 0), b.currency || "USD")}
                        </span>
                        <span className="text-[10px] text-secondary-400">{b.createdAt ? fmtDate(b.createdAt) : "—"}</span>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => setSelectedBookingDetails(b)}>
                        Inspect
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 4. ALL PROVIDERS TAB */}
      {activeTab === "providers" && (
        <Card className="border-secondary-200/80 shadow-sm overflow-hidden">
          <CardHeader className="bg-secondary-50/50 border-b border-secondary-100 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <span>Registered Providers Database</span>
                  <span className="text-xs font-bold bg-primary-100 text-primary-700 px-2.5 py-0.5 rounded-full">
                    {allProviders.length} Total
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Review new signups, approve credentials, feature on homepage, or ban accounts
                </CardDescription>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-secondary-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={providerSearch}
                  onChange={(e) => setProviderSearch(e.target.value)}
                  placeholder="Search providers..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-secondary-200 text-xs bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 pt-3 overflow-x-auto">
              {(["all", "pending", "approved", "featured", "banned"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setProviderFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap ${
                    providerFilter === f ? "bg-secondary-900 text-white" : "text-secondary-600 hover:bg-secondary-100"
                  }`}
                >
                  {f === "pending" ? `Pending Review (${pendingProviders.length})` : f}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loadingProviders ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-secondary-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredProviders.length === 0 ? (
              <div className="p-12 text-center text-xs text-secondary-400">
                No providers match your search or filter selection.
              </div>
            ) : (
              <div className="divide-y divide-secondary-100 max-h-[700px] overflow-y-auto">
                {filteredProviders.map((p) => (
                  <div
                    key={p.id}
                    className={`p-4 transition-colors flex items-center justify-between gap-4 flex-wrap text-xs ${
                      p.banned ? "bg-red-50/50" : "hover:bg-secondary-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0">
                        {(p.businessName || p.firstName || "P")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-secondary-900 text-sm flex items-center gap-2 flex-wrap">
                          <span className="truncate">{p.businessName || `${p.firstName} ${p.lastName}`}</span>
                          {p.isVerified && <span title="Verified ID"><ShieldCheck className="w-4 h-4 text-green-600 shrink-0" /></span>}
                          {p.isFeatured && <span title="Featured on Homepage"><Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" /></span>}
                          {p.isOnline && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Online now" />}
                          {p.banned && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.2 rounded-full uppercase">
                              Banned
                            </span>
                          )}
                        </div>
                        <div className="text-secondary-500 truncate">
                          {p.email} &middot; {p.servicesOffered || "General"} &middot; {p.location || "Location pending"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          p.status === "Approved"
                            ? "bg-green-100 text-green-700"
                            : p.status === "Rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {p.status}
                      </span>

                      {p.verificationDocumentUrl && (
                        <Link href={p.verificationDocumentUrl} target="_blank">
                          <Button size="sm" variant="outline" className="h-8 text-xs text-blue-600 border-blue-300" title="View Verification ID">
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> View ID
                          </Button>
                        </Link>
                      )}

                      <Link href={`/provider/${p.id}`} target="_blank">
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-secondary-500" title="View Public Profile">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>

                      {/* Homepage Featured Toggle */}
                      {p.status === "Approved" && !p.banned && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title={p.isFeatured ? "Remove from Homepage Feature" : "Feature on Homepage"}
                          isLoading={actionLoading === p.id + "_feature"}
                          onClick={() => toggleFeatured(p.id, p.isFeatured)}
                          className={`h-8 px-2 ${p.isFeatured ? "text-amber-500 hover:text-amber-600" : "text-secondary-400 hover:text-amber-500"}`}
                        >
                          <Star className={`w-4 h-4 ${p.isFeatured ? "fill-amber-500" : ""}`} />
                        </Button>
                      )}

                      {/* Approval Button */}
                      {p.status !== "Approved" && !p.banned && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-green-700 border-green-300 hover:bg-green-50"
                          isLoading={actionLoading === p.id + "_approve"}
                          onClick={() => approveProvider(p.id)}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                      )}

                      {/* View Credentials */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-blue-500 hover:bg-blue-50"
                        title="View Support Credentials"
                        onClick={() => viewCredentials(p.id, p.businessName || `${p.firstName} ${p.lastName}`)}
                      >
                        <Key className="w-4 h-4" />
                      </Button>

                      {/* Ban / Unban */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`h-8 px-2 ${p.banned ? "text-green-600 hover:bg-green-50" : "text-rose-500 hover:bg-rose-50"}`}
                        title={p.banned ? "Unban Provider" : "Ban Provider"}
                        onClick={() => toggleBanUser(p.id, "providers", !!p.banned)}
                      >
                        {p.banned ? <ShieldCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </Button>

                      {/* Delete */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-rose-500 hover:bg-rose-50"
                        title="Delete Provider Permanently"
                        onClick={() => deleteUser(p.id, "providers")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 5. ALL CUSTOMERS TAB */}
      {activeTab === "customers" && (
        <Card className="border-secondary-200/80 shadow-sm overflow-hidden">
          <CardHeader className="bg-secondary-50/50 border-b border-secondary-100 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <span>Registered Customers Database</span>
                  <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
                    {allCustomers.length} Total
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time record of all customers registered on the platform
                </CardDescription>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-secondary-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search customers..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-secondary-200 text-xs bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 pt-3 overflow-x-auto">
              {(["all", "online", "banned"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setCustomerFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap ${
                    customerFilter === f ? "bg-secondary-900 text-white" : "text-secondary-600 hover:bg-secondary-100"
                  }`}
                >
                  {f === "online" ? `Online Now (${onlineCustomersCount})` : f}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loadingCustomers ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-secondary-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-12 text-center text-xs text-secondary-400">
                No customers match your search query or filter.
              </div>
            ) : (
              <div className="divide-y divide-secondary-100 max-h-[700px] overflow-y-auto">
                {filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    className={`p-4 transition-colors flex items-center justify-between gap-4 flex-wrap text-xs ${
                      c.banned ? "bg-red-50/50" : "hover:bg-secondary-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold shrink-0">
                        {(c.firstName || c.email || "C")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-secondary-900 text-sm flex items-center gap-2 flex-wrap">
                          <span>
                            {c.firstName} {c.lastName}
                          </span>
                          {c.isOnline ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Online
                            </span>
                          ) : null}
                          {toMs(c.createdAt) >= todayMs && (
                            <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                              Joined Today
                            </span>
                          )}
                          {c.banned && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                              Banned
                            </span>
                          )}
                        </div>
                        <div className="text-secondary-500 truncate">
                          {c.email} {c.phone && `· ${c.phone}`} {c.country && `· ${c.country}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-secondary-400 hidden sm:block">
                        {c.createdAt ? fmtDate(c.createdAt) : "—"}
                      </span>

                      {/* Ban / Unban */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`h-8 px-2.5 ${c.banned ? "text-green-600 hover:bg-green-50" : "text-rose-500 hover:bg-rose-50"}`}
                        title={c.banned ? "Unban Customer" : "Ban Customer"}
                        onClick={() => toggleBanUser(c.id, "users", !!c.banned)}
                      >
                        {c.banned ? <ShieldCheck className="w-4 h-4 mr-1" /> : <Ban className="w-4 h-4 mr-1" />}
                        {c.banned ? "Unban" : "Ban"}
                      </Button>

                      {/* Delete */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-rose-500 hover:bg-rose-50"
                        title="Delete Customer Account"
                        onClick={() => deleteUser(c.id, "users")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 6. TRUST & SAFETY REPORTS TAB */}
      {activeTab === "reports" && (
        <Card className="border-secondary-200/80 shadow-sm overflow-hidden">
          <CardHeader className="bg-secondary-50/50 border-b border-secondary-100 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-600" /> Trust & Safety Reports Center ({allReports.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Review incidents reported by customers or providers. Ban bad actors and resolve tickets immediately.
                </CardDescription>
              </div>

              {/* Filter */}
              <div className="flex items-center gap-1.5">
                {(["all", "open", "resolved"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setReportFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                      reportFilter === f ? "bg-secondary-900 text-white" : "text-secondary-600 hover:bg-secondary-100"
                    }`}
                  >
                    {f === "open" ? `Open (${openReportsCount})` : f}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {filteredReports.length === 0 ? (
              <div className="text-center py-12 text-xs text-secondary-400">
                No reports found matching your current filter.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredReports.map((r) => (
                  <div
                    key={r.id}
                    className={`p-4 rounded-xl border text-xs ${
                      r.status === "open" ? "bg-rose-50/60 border-rose-200" : "bg-white border-secondary-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Flag className={`w-4 h-4 ${r.status === "open" ? "text-rose-600" : "text-secondary-400"}`} />
                        <span className="font-bold text-secondary-900 text-sm">
                          Report against: {r.targetName || "User"} ({r.targetType || "user"})
                        </span>
                        {r.status !== "open" ? (
                          <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                            Resolved: {r.resolution || "dismissed"}
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                            Open Incident
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-secondary-400">{r.createdAt ? fmtDate(r.createdAt) : "—"}</span>
                    </div>

                    <div className="space-y-1.5 text-secondary-700 pl-6">
                      <p>
                        <strong>Reason:</strong> {r.reason || "Unspecified"}
                      </p>
                      {r.description && <p className="italic bg-white/70 p-2 rounded-lg border border-secondary-100">"{r.description}"</p>}
                      <p className="text-[11px] text-secondary-500">
                        Reported by: <strong>{r.reporterName || "Anonymous User"}</strong>
                      </p>

                      {r.status === "open" && (
                        <div className="flex items-center gap-2 pt-3 mt-3 border-t border-rose-200/80">
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                            onClick={() => resolveReport(r.id, "ban", r.targetId, r.targetType)}
                          >
                            <Ban className="w-3.5 h-3.5 mr-1" /> Ban User & Resolve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-secondary-300"
                            onClick={() => resolveReport(r.id, "dismiss", r.targetId, r.targetType)}
                          >
                            Dismiss Report
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 7. MANAGE CATEGORIES TAB */}
      {activeTab === "categories" && (
        <Card className="border-secondary-200/80 shadow-sm overflow-hidden">
          <CardHeader className="bg-secondary-50/50 border-b border-secondary-100 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <LayoutDashboard className="w-5 h-5 text-indigo-600" /> Platform Categories Manager ({platformSettings.categories.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Click any category to test search results. Add, edit, re-arrange, hide, or delete categories.
                </CardDescription>
              </div>
            </div>

            {/* Add Category Form */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-4">
              <Input
                placeholder="Category Name (e.g. Electricians)"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                className="h-9 text-xs"
              />
              <Input
                placeholder="Search Query / Slug (e.g. Electricians)"
                value={newCategory.slug}
                onChange={(e) => setNewCategory({ ...newCategory, slug: e.target.value })}
                className="h-9 text-xs"
              />
              <Button onClick={addMasterCategory} size="sm" className="h-9 text-xs shrink-0 bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Category
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {platformSettings.categories.map((cat, index) => (
                <div
                  key={`${cat.name}-${index}`}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                    cat.hidden ? "bg-secondary-100 border-secondary-300 opacity-60" : "bg-white border-secondary-200 hover:border-indigo-400"
                  }`}
                >
                  <Link
                    href={`/search?q=${encodeURIComponent(cat.slug || cat.name)}`}
                    target="_blank"
                    className="flex-1 min-w-0 group"
                    title="Click to preview on search page"
                  >
                    <div className="font-bold text-sm text-secondary-900 group-hover:text-indigo-600 flex items-center gap-1.5 truncate">
                      <span>{cat.name}</span>
                      <ExternalLink className="w-3 h-3 text-secondary-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                    <div className="text-[11px] text-secondary-400 font-mono truncate">
                      q={cat.slug || cat.name} {cat.hidden && "· (Hidden)"}
                    </div>
                  </Link>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveMasterCategory(index, -1)}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-secondary-100 text-secondary-500 disabled:opacity-30"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => moveMasterCategory(index, 1)}
                      disabled={index === platformSettings.categories.length - 1}
                      className="p-1 rounded hover:bg-secondary-100 text-secondary-500 disabled:opacity-30"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleHideMasterCategory(index)}
                      className={`p-1 rounded hover:bg-secondary-100 ${cat.hidden ? "text-secondary-400" : "text-green-600"}`}
                      title={cat.hidden ? "Show Category" : "Hide Category"}
                    >
                      {cat.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setEditingItem({
                          type: "category",
                          index,
                          name: cat.name,
                          slug: cat.slug || cat.name,
                        })
                      }
                      className="p-1 rounded hover:bg-secondary-100 text-blue-600"
                      title="Edit Category"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => removeMasterCategory(index)}
                      className="p-1 rounded hover:bg-red-50 text-red-500"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 8. HOMEPAGE CMS TAB */}
      {activeTab === "homepage CMS" && (
        <div className="space-y-6">
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 p-4 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>
              All modifications here update in real time on the live Promoh homepage without requiring code redeployments.
            </span>
          </div>

          {/* Global Announcement Editor */}
          <Card className="border-primary-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-primary-50/70 border-b border-primary-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-primary-950 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-primary-600" /> Global Announcement Banner
                  </CardTitle>
                  <CardDescription className="text-primary-800 text-xs">
                    Broadcast a prominent alert banner at the very top of the live website
                  </CardDescription>
                </div>
                {platformSettings.announcement.isActive && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full">
                    Live on Site
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-secondary-700 block mb-1.5">
                  Announcement Message
                </label>
                <Input
                  placeholder="e.g. 🎉 Welcome to Promoh! Get $20 off your first service booking today with code PROMO20."
                  value={announcementMsg}
                  onChange={(e) => setAnnouncementMsg(e.target.value)}
                  className="h-10 text-xs sm:text-sm"
                />
              </div>

              {/* Live Banner Preview */}
              {announcementMsg && (
                <div className="p-3 bg-primary-600 text-white rounded-xl text-xs font-medium flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2 flex-1 justify-center">
                    <AlertTriangle className="w-4 h-4 text-primary-100 shrink-0" />
                    <span>{announcementMsg}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-primary-200 ml-2">Preview</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="banner-active"
                    checked={announcementActive}
                    onChange={(e) => setAnnouncementActive(e.target.checked)}
                    className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-secondary-300"
                  />
                  <label htmlFor="banner-active" className="text-xs font-bold text-secondary-800 cursor-pointer select-none">
                    Banner Active (Show on Homepage & Platform)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  {platformSettings.announcement.message && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={removeAnnouncement}
                      className="h-9 text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove Announcement
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={updateAnnouncement}
                    className="h-9 text-xs bg-primary-600 hover:bg-primary-700 text-white font-semibold"
                  >
                    Save & Publish Live
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Popular Categories & Emergency Services */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Popular Categories */}
            <Card className="border-secondary-200/80 shadow-sm">
              <CardHeader className="bg-secondary-50/50 border-b border-secondary-100 pb-3">
                <CardTitle className="text-base">Popular Search Pills</CardTitle>
                <CardDescription className="text-xs">
                  Quick pills displayed under the main search bar on the homepage
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Electricians"
                    value={newPopular}
                    onChange={(e) => setNewPopular(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addPopularCat()}
                    className="h-9 text-xs"
                  />
                  <Button size="sm" onClick={addPopularCat} className="h-9 text-xs shrink-0">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {platformSettings.popularCategories.map((cat, idx) => (
                    <div
                      key={`${cat}-${idx}`}
                      className="flex items-center gap-2 px-3 py-1.5 bg-secondary-100 border border-secondary-200 rounded-full text-xs font-semibold text-secondary-800"
                    >
                      <span>{cat}</span>
                      <button
                        type="button"
                        onClick={() => setEditingItem({ type: "popular", index: idx, name: cat })}
                        className="text-secondary-400 hover:text-blue-600"
                        title="Edit"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removePopularCat(cat)}
                        className="text-secondary-400 hover:text-rose-600"
                        title="Delete"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Emergency Services */}
            <Card className="border-secondary-200/80 shadow-sm">
              <CardHeader className="bg-secondary-50/50 border-b border-secondary-100 pb-3">
                <CardTitle className="text-base text-rose-950 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" /> Emergency 24/7 Services
                </CardTitle>
                <CardDescription className="text-xs">
                  Red highlighted emergency chips on the homepage
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Name (e.g. 24/7 Plumber)"
                    value={newEmergency.name}
                    onChange={(e) => setNewEmergency({ ...newEmergency, name: e.target.value })}
                    className="h-9 text-xs"
                  />
                  <Input
                    placeholder="Search query (e.g. Plumbers)"
                    value={newEmergency.slug}
                    onChange={(e) => setNewEmergency({ ...newEmergency, slug: e.target.value })}
                    className="h-9 text-xs"
                  />
                  <Button size="sm" onClick={addEmergencyService} className="h-9 text-xs shrink-0 bg-rose-600 hover:bg-rose-700">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add
                  </Button>
                </div>

                <div className="space-y-2 pt-2">
                  {platformSettings.emergencyServices.map((svc, idx) => (
                    <div
                      key={`${svc.name}-${idx}`}
                      className="flex items-center justify-between p-3 bg-rose-50/60 border border-rose-200 rounded-xl text-xs"
                    >
                      <div>
                        <span className="font-bold text-rose-900 block">{svc.name}</span>
                        <span className="text-[11px] text-rose-600 font-mono">/search?q={svc.slug}&emergency=true</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingItem({ type: "emergency", index: idx, name: svc.name, slug: svc.slug })}
                          className="p-1 hover:bg-rose-100 rounded text-blue-600"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeEmergencyService(svc.name)}
                          className="p-1 hover:bg-rose-100 rounded text-rose-600"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Explore Categories Grid */}
            <Card className="md:col-span-2 border-secondary-200/80 shadow-sm">
              <CardHeader className="bg-secondary-50/50 border-b border-secondary-100 pb-3">
                <CardTitle className="text-base">Explore Categories Grid</CardTitle>
                <CardDescription className="text-xs">
                  The primary category cards shown in the prominent homepage section
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
                  <Input
                    placeholder="Display Name (e.g. Electricians)"
                    value={newExplore.name}
                    onChange={(e) => setNewExplore({ ...newExplore, name: e.target.value })}
                    className="h-9 text-xs"
                  />
                  <Input
                    placeholder="Search Slug (e.g. Electricians)"
                    value={newExplore.slug}
                    onChange={(e) => setNewExplore({ ...newExplore, slug: e.target.value })}
                    className="h-9 text-xs"
                  />
                  <Button size="sm" onClick={addExploreCategory} className="h-9 text-xs shrink-0">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add to Grid
                  </Button>
                </div>

                <div className="space-y-2 pt-2">
                  {platformSettings.exploreCategories.map((cat, index) => (
                    <div
                      key={`${cat.name}-${index}`}
                      className="flex items-center justify-between p-3 bg-white border border-secondary-200 rounded-xl text-xs hover:border-secondary-300"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-secondary-100 flex items-center justify-center font-bold text-secondary-600">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-bold text-secondary-900">{cat.name}</div>
                          <div className="text-[11px] text-secondary-500 font-mono">/search?q={cat.slug}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => moveExploreCategory(index, -1)}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-secondary-100 text-secondary-500 disabled:opacity-30"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveExploreCategory(index, 1)}
                          disabled={index === platformSettings.exploreCategories.length - 1}
                          className="p-1 rounded hover:bg-secondary-100 text-secondary-500 disabled:opacity-30"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingItem({ type: "explore", index, name: cat.name, slug: cat.slug })}
                          className="p-1 rounded hover:bg-secondary-100 text-blue-600"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeExploreCategory(cat.name)}
                          className="p-1 rounded hover:bg-red-50 text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Edit Item Modal (Used across Popular, Emergency, Explore & Master Categories) */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-secondary-200">
            <div className="bg-secondary-50 p-4 border-b border-secondary-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-secondary-900">
                Edit {editingItem.type.charAt(0).toUpperCase() + editingItem.type.slice(1)} Item
              </h3>
              <button onClick={() => setEditingItem(null)} className="text-secondary-400 hover:text-secondary-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-secondary-700 uppercase tracking-wider block mb-1">
                  Display Name
                </label>
                <Input
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="h-10 text-xs"
                />
              </div>

              {editingItem.type !== "popular" && (
                <div>
                  <label className="text-xs font-semibold text-secondary-700 uppercase tracking-wider block mb-1">
                    Search Slug / Query
                  </label>
                  <Input
                    value={editingItem.slug || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, slug: e.target.value })}
                    className="h-10 text-xs font-mono"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-secondary-100">
                <Button size="sm" variant="ghost" onClick={() => setEditingItem(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit} className="bg-primary-600 hover:bg-primary-700 text-white">
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      {selectedBookingDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-secondary-200">
            <div className="bg-secondary-50 p-4 border-b border-secondary-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-secondary-900">Booking Record Details</h3>
                <p className="text-[11px] text-secondary-500 font-mono">ID: {selectedBookingDetails.id}</p>
              </div>
              <button onClick={() => setSelectedBookingDetails(null)} className="text-secondary-400 hover:text-secondary-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-3.5 text-xs text-secondary-700">
              <div className="grid grid-cols-2 gap-3 p-3 bg-secondary-50/70 rounded-xl">
                <div>
                  <span className="text-[10px] uppercase font-bold text-secondary-400 block">Customer</span>
                  <span className="font-bold text-secondary-900">{selectedBookingDetails.customerName}</span>
                  <div className="text-secondary-500">{selectedBookingDetails.customerEmail}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-secondary-400 block">Provider</span>
                  <span className="font-bold text-secondary-900">{selectedBookingDetails.providerName}</span>
                  <div className="text-secondary-500">{selectedBookingDetails.service}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="font-semibold block text-secondary-900">Date & Time</span>
                  <span>{selectedBookingDetails.date} at {selectedBookingDetails.time}</span>
                </div>
                <div>
                  <span className="font-semibold block text-secondary-900">Status</span>
                  <span className="capitalize">{selectedBookingDetails.status}</span>
                </div>
                <div>
                  <span className="font-semibold block text-secondary-900">Amount / Rate</span>
                  <span className="font-bold text-green-700 text-sm">
                    {formatCurrency(Number(selectedBookingDetails.amount || selectedBookingDetails.estimatedRate || 0), selectedBookingDetails.currency || "USD")}
                  </span>
                </div>
                <div>
                  <span className="font-semibold block text-secondary-900">Payment Status</span>
                  <span className="capitalize">{selectedBookingDetails.paymentStatus || "pending"}</span>
                </div>
              </div>

              {selectedBookingDetails.address && (
                <div>
                  <span className="font-semibold block text-secondary-900">Service Location</span>
                  <span>{selectedBookingDetails.address}</span>
                </div>
              )}

              {selectedBookingDetails.notes && (
                <div>
                  <span className="font-semibold block text-secondary-900">Customer Notes</span>
                  <div className="italic p-2 bg-secondary-50 rounded-lg">{selectedBookingDetails.notes}</div>
                </div>
              )}

              {selectedBookingDetails.rejectionReason && (
                <div className="p-2.5 bg-rose-50 text-rose-800 rounded-lg border border-rose-200">
                  <strong>Decline Reason:</strong> {selectedBookingDetails.rejectionReason}
                  {selectedBookingDetails.rejectionNote && ` — "${selectedBookingDetails.rejectionNote}"`}
                </div>
              )}

              <div className="pt-3 border-t border-secondary-100 flex justify-end">
                <Button size="sm" onClick={() => setSelectedBookingDetails(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
