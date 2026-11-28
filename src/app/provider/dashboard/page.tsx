"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import { useEffect, useState, useMemo, useRef } from "react";
import { playNotificationChime } from "@/lib/audio";
import { db } from "@/lib/firebase/client";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import {
  ShieldAlert,
  TrendingUp,
  Calendar,
  Star,
  MessageSquare,
  CheckCircle,
  XCircle,
  MapPin,
  Search,
  Phone,
  Mail,
  Navigation,
  DollarSign,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Store,
  Copy,
  Check,
  X,
} from "lucide-react";
import { formatCurrency } from "@/lib/currencies";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import BookingStatusStepper from "@/components/booking/BookingStatusStepper";

// Subcomponents
import CompleteBookingModal from "@/components/provider/CompleteBookingModal";
import RejectBookingModal from "@/components/provider/RejectBookingModal";
import RealEarningsChart from "@/components/provider/RealEarningsChart";
import AvailabilityScheduleCard from "@/components/provider/AvailabilityScheduleCard";
import PayoutsCard from "@/components/provider/PayoutsCard";
import ProviderReviewsManager from "@/components/provider/ProviderReviewsManager";
import { ProviderBadgesDashboardCard } from "@/components/provider/ProviderBadges";
import ProviderBookingsCalendar from "@/components/provider/ProviderBookingsCalendar";

type BookingTab = "all" | "pending" | "active" | "completed" | "cancelled";

export default function ProviderDashboardPage() {
  const { user } = useAuth();
  const [providerData, setProviderData] = useState<any>(null);
  const [earnings, setEarnings] = useState(0);
  const [activeBookings, setActiveBookings] = useState(0);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const isInitialBookings = useRef(true);
  const [newBookingAlert, setNewBookingAlert] = useState<{
    bookingId: string;
    customerName: string;
    service: string;
    amount?: number;
  } | null>(null);

  // Tab & Search filters for Bookings
  const [selectedTab, setSelectedTab] = useState<BookingTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [completeBooking, setCompleteBooking] = useState<any | null>(null);
  const [rejectBooking, setRejectBooking] = useState<any | null>(null);

  // Active Main Section Tab
  const [activeSection, setActiveSection] = useState<"overview" | "calendar" | "availability" | "payouts" | "reviews">("overview");

  // Handle standard status updates (e.g. Accept, Start Service)
  const handleUpdateBooking = async (
    id: string,
    newStatus: string,
    customerId: string,
    amount?: number
  ) => {
    setUpdatingId(id);
    try {
      const updates: any = { status: newStatus, updatedAt: new Date().toISOString() };
      if (amount !== undefined) updates.amount = amount;
      await updateDoc(doc(db, "bookings", id), updates);

      // Notification to Customer
      await addDoc(collection(db, "notifications"), {
        userId: customerId,
        title:
          newStatus === "accepted"
            ? "✅ Booking Accepted!"
            : newStatus === "in_progress"
            ? "🚀 Service Started"
            : "Booking Update",
        message:
          newStatus === "accepted"
            ? `${providerData?.businessName || "Your provider"} accepted your booking request.`
            : newStatus === "in_progress"
            ? `${providerData?.businessName || "Your provider"} has started your service.`
            : `Your booking status has been updated to: ${newStatus.replace("_", " ")}`,
        link: "/dashboard",
        type: newStatus === "completed" ? "booking_completed" : "booking_update",
        read: false,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error updating booking", error);
      alert("Failed to update booking status");
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Complete Booking with custom amounts and receipt notes
  const handleConfirmComplete = async (
    bookingId: string,
    amount: number,
    options: { notes: string; isCashPaid: boolean }
  ) => {
    const booking = recentRequests.find((r) => r.id === bookingId);
    if (!booking) return;

    const updates: any = {
      status: "completed",
      amount,
      completionNotes: options.notes,
      paymentStatus: options.isCashPaid ? "paid" : "pending",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(doc(db, "bookings", bookingId), updates);

    // Notify customer
    await addDoc(collection(db, "notifications"), {
      userId: booking.customerId,
      title: "🎉 Service Completed",
      message: `${providerData?.businessName || "Your provider"} has completed your service. Total: ${formatCurrency(
        amount,
        currency
      )}. ${
        options.isCashPaid
          ? "Payment settled."
          : "Please review and complete payment."
      }`,
      link: options.isCashPaid ? "/dashboard" : `/payment/${bookingId}`,
      type: "booking_completed",
      read: false,
      createdAt: new Date().toISOString(),
    });
  };

  // Handle Reject Booking with reason and explanation note
  const handleConfirmReject = async (
    bookingId: string,
    reason: string,
    note: string
  ) => {
    const booking = recentRequests.find((r) => r.id === bookingId);
    if (!booking) return;

    await updateDoc(doc(db, "bookings", bookingId), {
      status: "rejected",
      rejectionReason: reason,
      rejectionNote: note,
      updatedAt: new Date().toISOString(),
    });

    await addDoc(collection(db, "notifications"), {
      userId: booking.customerId,
      title: "Booking Request Update",
      message: `Your booking for ${booking.service} was declined: "${reason}". ${
        note ? `Note from provider: ${note}` : "You can explore other available pros."
      }`,
      link: "/dashboard",
      type: "booking_update",
      read: false,
      createdAt: new Date().toISOString(),
    });
  };

  useEffect(() => {
    if (!user?.uid) return;

    const unsubProvider = onSnapshot(doc(db, "providers", user.uid), (docSnap) => {
      if (docSnap.exists()) setProviderData(docSnap.data());
    });

    const bookingsQ = query(
      collection(db, "bookings"),
      where("providerId", "==", user.uid)
    );

    const unsubBookings = onSnapshot(bookingsQ, (snapshot) => {
      let total = 0;
      let active = 0;
      const allBookings: any[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        allBookings.push({ id: docSnap.id, ...data });

        if (data.status === "completed") {
          total += Number(data.amount || 0);
        }
        if (
          data.status === "pending" ||
          data.status === "accepted" ||
          data.status === "in_progress"
        ) {
          active++;
        }
      });

      allBookings.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

      if (!isInitialBookings.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            if (data.status === "pending") {
              playNotificationChime();
              setNewBookingAlert({
                bookingId: change.doc.id,
                customerName: data.customerName || "New Customer",
                service: data.service || "Service Request",
                amount: data.amount,
              });
              setTimeout(() => {
                setNewBookingAlert((curr) => (curr?.bookingId === change.doc.id ? null : curr));
              }, 10000);
            }
          }
        });
      }
      isInitialBookings.current = false;

      setEarnings(total);
      setActiveBookings(active);
      setRecentRequests(allBookings);
    });

    return () => {
      unsubProvider();
      unsubBookings();
    };
  }, [user?.uid]);

  const [checklistDismissed, setChecklistDismissed] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const checklistItems = useMemo(() => {
    return [
      {
        id: "photo",
        label: "Upload Profile Avatar",
        done: !!providerData?.photoURL,
        link: "/provider/dashboard/profile",
      },
      {
        id: "bio",
        label: "Write Business Description",
        done: !!providerData?.description && providerData.description.length > 20,
        link: "/provider/dashboard/profile",
      },
      {
        id: "services",
        label: "List Your Services & Pricing",
        done: !!(providerData?.serviceCards?.length || providerData?.servicesOffered),
        link: "/provider/dashboard/profile",
      },
      {
        id: "schedule",
        label: "Set Weekly Working Schedule",
        done: !!providerData?.availability?.workingDays?.length,
        action: () => setActiveSection("availability"),
      },
      {
        id: "verification",
        label: "Submit Verification Documents",
        done: providerData?.status === "Approved" || !!providerData?.verificationDocumentUrl,
        link: "/provider/dashboard/verification",
      },
      {
        id: "portfolio",
        label: "Add Portfolio Photos (at least 1)",
        done: (providerData?.portfolioURLs?.length || 0) >= 1,
        link: "/provider/dashboard/profile",
      },
    ];
  }, [providerData]);
  const completedChecklistCount = checklistItems.filter(i => i.done).length;
  const isAllChecklistDone = completedChecklistCount === checklistItems.length;

  const currency = providerData?.currency || "USD";
  const rating = providerData?.rating ? providerData.rating.toFixed(1) : "New";
  const isProfileComplete =
    providerData?.photoURL &&
    providerData?.servicesOffered &&
    providerData?.hourlyRate;

  // Count by statuses for badges
  const pendingCount = useMemo(
    () => recentRequests.filter((r) => r.status === "pending").length,
    [recentRequests]
  );
  const activeCount = useMemo(
    () =>
      recentRequests.filter(
        (r) => r.status === "accepted" || r.status === "in_progress"
      ).length,
    [recentRequests]
  );
  const completedCount = useMemo(
    () => recentRequests.filter((r) => r.status === "completed").length,
    [recentRequests]
  );
  const cancelledCount = useMemo(
    () =>
      recentRequests.filter(
        (r) => r.status === "rejected" || r.status === "cancelled"
      ).length,
    [recentRequests]
  );

  // Filter bookings based on active tab and search query
  const filteredRequests = useMemo(() => {
    return recentRequests.filter((req) => {
      const matchesTab =
        selectedTab === "all"
          ? true
          : selectedTab === "pending"
          ? req.status === "pending"
          : selectedTab === "active"
          ? req.status === "accepted" || req.status === "in_progress"
          : selectedTab === "completed"
          ? req.status === "completed"
          : req.status === "rejected" || req.status === "cancelled";

      if (!matchesTab) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        req.customerName?.toLowerCase().includes(q) ||
        req.service?.toLowerCase().includes(q) ||
        req.address?.toLowerCase().includes(q) ||
        req.notes?.toLowerCase().includes(q)
      );
    });
  }, [recentRequests, selectedTab, searchQuery]);

  return (
    <div className="p-3 sm:p-4 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 relative">
      {/* Real-time New Booking Alert Banner */}
      <AnimatePresence>
        {newBookingAlert && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-lg bg-gradient-to-r from-emerald-600 via-teal-600 to-primary-600 text-white p-4 rounded-2xl shadow-[0_15px_35px_rgba(5,150,105,0.35)] border border-emerald-300/40 flex items-center justify-between gap-3 backdrop-blur-md"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl animate-bounce">🔔</span>
              <div className="min-w-0">
                <p className="font-bold text-sm tracking-tight truncate">
                  New Booking Request from {newBookingAlert.customerName}!
                </p>
                <p className="text-xs text-white/90 truncate">
                  {newBookingAlert.service} {newBookingAlert.amount ? `• $${newBookingAlert.amount}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setSelectedTab("pending");
                  setNewBookingAlert(null);
                }}
                className="px-3 py-1.5 bg-white text-emerald-800 text-xs font-bold rounded-xl shadow-xs hover:bg-emerald-50 transition-colors"
              >
                Review
              </button>
              <button
                onClick={() => setNewBookingAlert(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-secondary-900">
            Welcome back,{" "}
            {providerData?.businessName ||
              providerData?.firstName ||
              user?.displayName?.split(" ")[0] ||
              "Provider"}
          </h1>
          <p className="text-secondary-500 mt-1">
            Manage your service requests, schedule, and earnings from your command center.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Live Online Presence Switch */}
          <button
            type="button"
            onClick={async () => {
              const nextState = providerData?.isOnline === false ? true : false;
              if (user?.uid) {
                await updateDoc(doc(db, "providers", user.uid), { isOnline: nextState }).catch(() => {});
                await updateDoc(doc(db, "users", user.uid), { isOnline: nextState }).catch(() => {});
              }
            }}
            className={`flex items-center gap-2 px-3.5 py-2 h-10 rounded-xl text-xs font-bold border transition-all shadow-xs cursor-pointer ${
              providerData?.isOnline !== false
                ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                : "bg-secondary-100 border-secondary-300 text-secondary-600 hover:bg-secondary-200"
            }`}
            title="Toggle whether you appear online in search results"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                providerData?.isOnline !== false ? "bg-green-500 animate-pulse" : "bg-secondary-400"
              }`}
            />
            <span>{providerData?.isOnline !== false ? "Online & Available" : "Offline / On Break"}</span>
          </button>

          {!user?.isVerified && (
            <div className="flex items-center gap-3 bg-amber-50 text-amber-800 px-4 py-2 rounded-2xl border border-amber-200">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs sm:text-sm font-medium">
                Pending verification
              </div>
              <Link href="/provider/dashboard/verification">
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-1 bg-white text-amber-900 border-amber-300 hover:bg-amber-50 h-7 text-xs"
                >
                  Verify
                </Button>
              </Link>
            </div>
          )}

          {user?.uid && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/provider/${user.uid}`);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="h-10 px-3.5 rounded-xl font-semibold gap-2 border-secondary-300 hover:bg-secondary-50"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-secondary-600" />}
              {copiedLink ? "Link Copied!" : "Copy Profile Link"}
            </Button>
          )}

          <Link href="/provider/dashboard/profile">
            <Button variant="outline" size="sm" className="h-10 px-4 rounded-xl font-semibold gap-2 border-secondary-300 hover:border-primary-500 hover:bg-primary-50">
              <Store className="w-4 h-4 text-primary-600" />
              Edit Profile & Services
            </Button>
          </Link>

          {user?.uid && (
            <Link href={`/provider/${user.uid}`} target="_blank">
              <Button size="sm" className="h-10 px-4 rounded-xl font-semibold gap-2 shadow-sm shadow-primary-500/20">
                <ExternalLink className="w-4 h-4" />
                View Public Page
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Onboarding Checklist Widget */}
      {!checklistDismissed && !isAllChecklistDone && (
        <Card className="border-primary-200 bg-gradient-to-r from-primary-50/70 via-indigo-50/40 to-white shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-primary-100/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base text-secondary-900 font-bold">
                    Provider Setup Checklist ({completedChecklistCount}/{checklistItems.length} completed)
                  </CardTitle>
                  <CardDescription className="text-xs text-secondary-600">
                    Complete your profile to rank higher in searches and win more customer bookings.
                  </CardDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChecklistDismissed(true)}
                className="text-secondary-400 hover:text-secondary-700 p-1 rounded-lg hover:bg-white/80 transition-colors text-xs font-bold"
                title="Dismiss checklist"
              >
                ✕
              </button>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-secondary-200/80 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(completedChecklistCount / checklistItems.length) * 100}%` }}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {checklistItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${
                    item.done
                      ? "bg-white/90 border-emerald-200 text-secondary-700"
                      : "bg-white border-secondary-200 hover:border-primary-300 text-secondary-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-secondary-300 shrink-0" />
                    )}
                    <span className={`font-medium truncate ${item.done ? "line-through text-secondary-400" : ""}`}>
                      {item.label}
                    </span>
                  </div>
                  {!item.done && (
                    item.link ? (
                      <Link href={item.link}>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] shrink-0 font-medium ml-2">
                          Start
                        </Button>
                      </Link>
                    ) : (
                      <Button size="sm" variant="outline" onClick={item.action} className="h-6 px-2 text-[11px] shrink-0 font-medium ml-2">
                        Start
                      </Button>
                    )
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Urgent Pending Request Banner */}
      {pendingCount > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-white animate-spin" />
            </div>
            <div>
              <h4 className="font-bold text-sm">
                {pendingCount} Pending Booking Request{pendingCount > 1 ? "s" : ""} Awaiting Your Response
              </h4>
              <p className="text-xs text-amber-100 mt-0.5">
                Fast responses boost your Provider Trust Score and search ranking.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setSelectedTab("pending")}
            className="bg-white text-amber-900 hover:bg-amber-50 font-bold text-xs h-9 px-4 shrink-0 shadow-sm"
          >
            Review Pending ({pendingCount})
          </Button>
        </div>
      )}

      {/* Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-secondary-200 pb-2 overflow-x-auto -mx-3 sm:-mx-4 md:mx-0 px-3 sm:px-4 md:px-0">
        <button
          type="button"
          onClick={() => setActiveSection("overview")}
          className={`shrink-0 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
            activeSection === "overview"
              ? "bg-primary-600 text-white shadow-sm"
              : "text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Dashboard & Bookings
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("calendar")}
          className={`shrink-0 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
            activeSection === "calendar"
              ? "bg-primary-600 text-white shadow-sm"
              : "text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Schedule Calendar
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("availability")}
          className={`shrink-0 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
            activeSection === "availability"
              ? "bg-primary-600 text-white shadow-sm"
              : "text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Working Schedule
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("payouts")}
          className={`shrink-0 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
            activeSection === "payouts"
              ? "bg-primary-600 text-white shadow-sm"
              : "text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Payouts & Stripe
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("reviews")}
          className={`shrink-0 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
            activeSection === "reviews"
              ? "bg-primary-600 text-white shadow-sm"
              : "text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Reviews & Replies
        </button>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border-transparent shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Lifetime
              </span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-secondary-900">
              {formatCurrency(earnings, currency)}
            </h3>
            <p className="text-xs text-secondary-500 font-medium mt-1">Completed revenue</p>
          </CardContent>
        </Card>

        <Card className="border-transparent shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Active
              </span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-secondary-900">
              {activeBookings}
            </h3>
            <p className="text-xs text-secondary-500 font-medium mt-1">Bookings to fulfill</p>
          </CardContent>
        </Card>

        <Card className="border-transparent shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Requests
              </span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-secondary-900">
              {pendingCount}
            </h3>
            <p className="text-xs text-secondary-500 font-medium mt-1">Awaiting response</p>
          </CardContent>
        </Card>

        <Card className="border-transparent shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-11 h-11 bg-yellow-50 rounded-xl flex items-center justify-center text-yellow-600">
                <Star className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-yellow-700 bg-yellow-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Rating
              </span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-secondary-900">
              {rating}
            </h3>
            <p className="text-xs text-secondary-500 font-medium mt-1">
              Based on {providerData?.reviewCount || 0} reviews
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar View Section */}
      {activeSection === "calendar" && (
        <ProviderBookingsCalendar
          bookings={recentRequests}
          currency={currency}
        />
      )}

      {/* Availability Schedule Section (When active or toggleable) */}
      {activeSection === "availability" && (
        <AvailabilityScheduleCard
          providerId={user?.uid || ""}
          initialAvailability={providerData?.availability}
          bookings={recentRequests}
        />
      )}

      {/* Payouts Section (When active or toggleable) */}
      {activeSection === "payouts" && (
        <PayoutsCard
          providerId={user?.uid || ""}
          providerData={providerData}
          bookings={recentRequests}
          currency={currency}
        />
      )}

      {/* Reviews & Public Replies Section */}
      {activeSection === "reviews" && (
        <ProviderReviewsManager
          providerId={user?.uid || ""}
          providerData={providerData}
        />
      )}

      {/* Real Analytics Chart (Always visible on Overview) */}
      {activeSection === "overview" && (
        <RealEarningsChart bookings={recentRequests} currency={currency} />
      )}

      {/* Main Grid: Booking Management + Quick Tools */}
      {activeSection === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Booking Management (2 Columns) */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-secondary-200/80 shadow-sm overflow-hidden">
              <CardHeader className="border-b border-secondary-100 pb-4 bg-secondary-50/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span>Booking Management</span>
                      <span className="text-xs font-bold bg-primary-100 text-primary-700 px-2.5 py-0.5 rounded-full">
                        {recentRequests.length} Total
                      </span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Filter, respond to, and manage your customer service pipeline
                    </CardDescription>
                  </div>

                  {/* Search Bar */}
                  <div className="relative w-full sm:w-60">
                    <Search className="w-4 h-4 text-secondary-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search bookings..."
                      className="w-full h-9 pl-9 pr-3 rounded-xl border border-secondary-200 text-xs bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 placeholder:text-secondary-400"
                    />
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 pt-3 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedTab("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      selectedTab === "all"
                        ? "bg-secondary-900 text-white shadow-sm"
                        : "text-secondary-600 hover:bg-secondary-100"
                    }`}
                  >
                    All ({recentRequests.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTab("pending")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      selectedTab === "pending"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "text-amber-700 hover:bg-amber-50"
                    }`}
                  >
                    Pending ({pendingCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTab("active")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      selectedTab === "active"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-blue-700 hover:bg-blue-50"
                    }`}
                  >
                    Active ({activeCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTab("completed")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      selectedTab === "completed"
                        ? "bg-green-600 text-white shadow-sm"
                        : "text-green-700 hover:bg-green-50"
                    }`}
                  >
                    Completed ({completedCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTab("cancelled")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      selectedTab === "cancelled"
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-rose-700 hover:bg-rose-50"
                    }`}
                  >
                    Cancelled ({cancelledCount})
                  </button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {filteredRequests.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center text-secondary-400">
                    <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mb-4">
                      <Calendar className="w-8 h-8 text-secondary-300" />
                    </div>
                    <p className="font-semibold text-secondary-800">No requests found</p>
                    <p className="text-xs text-secondary-500 mt-1 max-w-sm">
                      {searchQuery
                        ? "No bookings match your search query. Try clearing the search."
                        : `No bookings in the "${selectedTab}" category at this moment.`}
                    </p>
                    {searchQuery && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchQuery("")}
                        className="mt-4 text-xs h-8"
                      >
                        Clear Search
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-secondary-100 max-h-[700px] overflow-y-auto">
                    {filteredRequests.map((req, index) => (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        key={req.id}
                        className="p-5 hover:bg-secondary-50/60 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            {/* Service Name & Status Badge */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-secondary-900 text-base">
                                {req.service || "Booking Request"}
                              </span>
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                                  req.status === "pending"
                                    ? "bg-amber-100 text-amber-800"
                                    : req.status === "accepted"
                                    ? "bg-blue-100 text-blue-800"
                                    : req.status === "in_progress"
                                    ? "bg-indigo-100 text-indigo-800"
                                    : req.status === "completed"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {req.status.replace("_", " ")}
                              </span>

                              {/* Payment Status Pill */}
                              {req.status === "completed" && (
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                    req.paymentStatus === "paid"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {req.paymentStatus === "paid"
                                    ? "Paid"
                                    : "Payment Pending"}
                                </span>
                              )}
                            </div>

                            {/* Customer info & contact chips */}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-secondary-600">
                              <span className="font-semibold text-secondary-900">
                                {req.customerName}
                              </span>

                              {req.customerEmail && (
                                <a
                                  href={`mailto:${req.customerEmail}`}
                                  className="flex items-center gap-1 text-secondary-500 hover:text-primary-600"
                                  title="Send email to customer"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                  {req.customerEmail}
                                </a>
                              )}

                              {req.customerPhone && (
                                <a
                                  href={`tel:${req.customerPhone}`}
                                  className="flex items-center gap-1 text-secondary-500 hover:text-primary-600 font-medium"
                                  title="Call customer"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                  {req.customerPhone}
                                </a>
                              )}
                            </div>

                            {/* Date, Time & Clickable Map Directions */}
                            <div className="flex flex-wrap items-center gap-4 text-xs text-secondary-500">
                              <span className="flex items-center gap-1.5 font-medium">
                                <Calendar className="w-3.5 h-3.5 text-secondary-400" />
                                {new Date(req.date + "T12:00:00").toLocaleDateString(
                                  undefined,
                                  { weekday: "short", month: "short", day: "numeric" }
                                )}{" "}
                                at {req.time}
                              </span>

                              {req.address && (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                    req.address
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-primary-600 hover:underline"
                                  title="Open in Google Maps"
                                >
                                  <MapPin className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                                  <span className="truncate max-w-[220px]">
                                    {req.address}
                                  </span>
                                  <Navigation className="w-3 h-3 ml-0.5 opacity-70" />
                                </a>
                              )}
                            </div>

                            {/* Rejection / Cancellation Reason display */}
                            {req.rejectionReason && (
                              <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-800">
                                <span className="font-semibold">Reason:</span>{" "}
                                {req.rejectionReason}
                                {req.rejectionNote && ` — "${req.rejectionNote}"`}
                              </div>
                            )}

                            {/* Customer Notes */}
                            {req.notes && (
                              <div className="bg-white p-2.5 rounded-xl border border-secondary-200 text-xs text-secondary-600 italic">
                                "{req.notes}"
                              </div>
                            )}

                            {/* Live Booking Status Stepper */}
                            <div className="pt-2">
                              <BookingStatusStepper
                                status={req.status}
                                paymentStatus={req.paymentStatus}
                                compact
                              />
                            </div>
                          </div>

                          {/* Action Buttons Column */}
                          <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                            {/* Message Customer */}
                            <Link href={`/chat?provider=${req.customerId}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto h-8 px-2.5 text-xs text-secondary-600"
                              >
                                <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                                Chat
                              </Button>
                            </Link>

                            {/* Status-specific Action Buttons */}
                            {req.status === "pending" ? (
                              <div className="flex gap-2 w-full sm:w-auto">
                                <Button
                                  size="sm"
                                  className="flex-1 sm:flex-none h-8 px-3 bg-green-600 hover:bg-green-700 text-white text-xs"
                                  isLoading={updatingId === req.id}
                                  onClick={() =>
                                    handleUpdateBooking(
                                      req.id,
                                      "accepted",
                                      req.customerId
                                    )
                                  }
                                >
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                  Accept
                                </Button>

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="flex-1 sm:flex-none h-8 px-2.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-xs"
                                  onClick={() => setRejectBooking(req)}
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1" />
                                  Decline
                                </Button>
                              </div>
                            ) : req.status === "accepted" ? (
                              <Button
                                size="sm"
                                className="w-full sm:w-auto h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                                isLoading={updatingId === req.id}
                                onClick={() =>
                                  handleUpdateBooking(
                                    req.id,
                                    "in_progress",
                                    req.customerId
                                  )
                                }
                              >
                                Start Service
                              </Button>
                            ) : req.status === "in_progress" ? (
                              <Button
                                size="sm"
                                className="w-full sm:w-auto h-8 px-3.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold"
                                onClick={() => setCompleteBooking(req)}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                Mark Complete
                              </Button>
                            ) : req.status === "completed" ? (
                              <div className="text-right">
                                <div className="text-sm font-black text-green-700">
                                  {formatCurrency(
                                    Number(req.amount || 0),
                                    currency
                                  )}
                                </div>
                                <span className="text-[11px] text-secondary-500">
                                  {req.paymentStatus === "paid"
                                    ? "Settled in full"
                                    : "Invoice pending"}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Quick Profile & Business Widgets */}
          <div className="space-y-6">
            {/* Earned Badges & Achievements */}
            <ProviderBadgesDashboardCard
              providerData={providerData}
              bookings={recentRequests}
            />

            {/* Profile Health Checklist */}
            <Card className="border-secondary-200/80 shadow-sm">
              <CardHeader className="pb-3 border-b border-secondary-100">
                <CardTitle className="text-base">Profile Setup Checklist</CardTitle>
                <CardDescription className="text-xs">
                  A complete profile earns up to 3x more client inquiries
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-secondary-700">
                    Profile Photo
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      providerData?.photoURL
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {providerData?.photoURL ? "Done" : "Missing"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-secondary-700">
                    Services & Pricing
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      providerData?.servicesOffered && providerData?.hourlyRate
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {providerData?.servicesOffered && providerData?.hourlyRate
                      ? "Done"
                      : "Missing"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-secondary-700">
                    Verification
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      user?.isVerified
                        ? "bg-green-100 text-green-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {user?.isVerified ? "Verified" : "Required"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-secondary-700">
                    Schedule Configured
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      providerData?.availability?.workingDays?.length
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {providerData?.availability?.workingDays?.length
                      ? "Done"
                      : "Pending"}
                  </span>
                </div>

                <div className="pt-3 border-t border-secondary-100">
                  <Link href="/provider/dashboard/profile">
                    <Button
                      className="w-full text-xs h-9"
                      variant={isProfileComplete ? "outline" : "default"}
                    >
                      {isProfileComplete ? "Edit Profile" : "Complete Profile"}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Quick Schedule Management Shortcut */}
            <Card
              onClick={() => setActiveSection("availability")}
              className="border-indigo-100 bg-gradient-to-br from-indigo-50 to-blue-50/50 hover:border-indigo-300 transition-all cursor-pointer p-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-indigo-950">
                    Working Schedule
                  </h4>
                  <p className="text-xs text-indigo-700">
                    {providerData?.availability?.isAcceptingBookings === false
                      ? "Currently Paused"
                      : "Accepting Bookings"} &middot; Click to configure
                  </p>
                </div>
              </div>
            </Card>

            {/* Boost Profile Card */}
            <Card className="bg-gradient-to-br from-primary-600 to-indigo-700 text-white border-transparent overflow-hidden relative shadow-md">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <CardContent className="p-6 relative z-10">
                <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base font-bold mb-1.5">Boost Your Profile</h3>
                <p className="text-primary-100 text-xs mb-4 leading-relaxed">
                  Add portfolio photos, detailed pricing, and verified credentials to attract more high-paying clients.
                </p>
                <Link href="/provider/dashboard/profile">
                  <Button className="w-full bg-white text-primary-700 hover:bg-primary-50 font-semibold shadow-sm text-xs h-9">
                    Enhance Profile
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Complete Booking Modal */}
      <CompleteBookingModal
        booking={completeBooking}
        currency={currency}
        isOpen={!!completeBooking}
        onClose={() => setCompleteBooking(null)}
        onSuccess={handleConfirmComplete}
      />

      {/* Reject Booking Modal */}
      <RejectBookingModal
        booking={rejectBooking}
        isOpen={!!rejectBooking}
        onClose={() => setRejectBooking(null)}
        onReject={handleConfirmReject}
      />
    </div>
  );
}
