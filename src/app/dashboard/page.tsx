"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase/client";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Search, Heart, Clock, Star, MapPin, ShieldCheck, LogOut, MessageSquare,
  XCircle, CreditCard, CalendarCheck, LifeBuoy, User, Settings, Bell,
  ArrowRight, Receipt, DollarSign, Calendar, AlertTriangle, Sparkles, X, Check
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import ReviewModal from "@/components/reviews/ReviewModal";
import BookingStatusStepper from "@/components/booking/BookingStatusStepper";
import { formatCurrency } from "@/lib/currencies";
import { motion, AnimatePresence } from "framer-motion";

const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"
];

export default function CustomerDashboard() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [activeBookings, setActiveBookings] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [activeReview, setActiveReview] = useState<any>(null);
  const [bookingFilter, setBookingFilter] = useState<"all" | "pending" | "active" | "completed" | "cancelled">("all");
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && user.role !== "customer") router.push("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        setSavedCount(data.savedProviders?.length || 0);
      }
    });

    const bookingsQ = query(collection(db, "bookings"), where("customerId", "==", user.uid));
    const unsubBookings = onSnapshot(bookingsQ, (snapshot) => {
      let active = 0;
      let bookings: any[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        bookings.push({ id: docSnap.id, ...data });
        if (data.status === "pending" || data.status === "accepted" || data.status === "in_progress") {
          active++;
        }
      });
      bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllBookings(bookings);
      setActiveBookings(active);
    });

    // Real-time unread notifications listener
    const notifQ = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      where("read", "==", false)
    );
    const unsubNotifs = onSnapshot(notifQ, (snapshot) => {
      setUnreadNotifications(snapshot.size);
    });

    return () => {
      unsubUser();
      unsubBookings();
      unsubNotifs();
    };
  }, [user?.uid]);

  const [reschedulingBooking, setReschedulingBooking] = useState<any | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  const [cancellingBooking, setCancellingBooking] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("Schedule conflict");
  const [cancellingLoading, setCancellingLoading] = useState(false);

  const totalSpent = useMemo(() => {
    return allBookings
      .filter((b) => b.paymentStatus === "paid" || (b.status === "completed" && b.amount))
      .reduce((sum, b) => sum + Number(b.amount || 0), 0);
  }, [allBookings]);

  const completedCount = useMemo(() => {
    return allBookings.filter((b) => b.status === "completed").length;
  }, [allBookings]);

  const unpaidBookings = useMemo(() => {
    return allBookings.filter((b) => b.status === "completed" && b.paymentStatus !== "paid");
  }, [allBookings]);

  const handleSignOut = async () => { await signOut(); router.push("/"); };

  const handleConfirmReschedule = async () => {
    if (!reschedulingBooking || !rescheduleDate || !rescheduleTime) return;
    setRescheduleLoading(true);
    try {
      await updateDoc(doc(db, "bookings", reschedulingBooking.id), {
        date: rescheduleDate,
        time: rescheduleTime,
        rescheduledFrom: `${reschedulingBooking.date} at ${reschedulingBooking.time}`,
        rescheduledAt: new Date().toISOString(),
        rescheduleNote: rescheduleReason,
        updatedAt: new Date().toISOString(),
      });

      // Notify provider
      await addDoc(collection(db, "notifications"), {
        userId: reschedulingBooking.providerId,
        title: "📅 Booking Rescheduled",
        message: `${user?.displayName || "The customer"} rescheduled their booking for ${reschedulingBooking.service} to ${rescheduleDate} at ${rescheduleTime}.`,
        link: "/provider/dashboard",
        type: "booking_update",
        read: false,
        createdAt: new Date().toISOString(),
      });

      setReschedulingBooking(null);
      setRescheduleDate("");
      setRescheduleTime("");
      setRescheduleReason("");
    } catch (err) {
      console.error("Failed to reschedule booking:", err);
    } finally {
      setRescheduleLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return;
    setCancellingLoading(true);
    try {
      await updateDoc(doc(db, "bookings", cancellingBooking.id), {
        status: "cancelled",
        cancelReason: cancelReason,
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await addDoc(collection(db, "notifications"), {
        userId: cancellingBooking.providerId,
        title: "🚫 Booking Cancelled",
        message: `${user?.displayName || "The customer"} cancelled the booking for ${cancellingBooking.date}. Reason: ${cancelReason}`,
        link: "/provider/dashboard",
        type: "booking_update",
        read: false,
        createdAt: new Date().toISOString(),
      });

      setCancellingBooking(null);
    } catch (err) {
      console.error("Error cancelling booking:", err);
    } finally {
      setCancellingLoading(false);
    }
  };

  if (loading || !user) return (
    <div className="min-h-screen bg-secondary-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-secondary-50 pb-20">
      <nav className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Promoh" width={32} height={32} className="w-auto h-7 sm:h-8 object-contain" />
            <span className="text-lg sm:text-xl font-bold text-primary-600 hidden sm:block">Promoh</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            <Link href="/search"><Button variant="ghost" size="sm"><Search className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Find Pros</span></Button></Link>
            
            {/* Live Notification Bell */}
            <Link
              href="/notifications"
              className="relative p-2 text-secondary-600 hover:text-secondary-900 rounded-xl hover:bg-secondary-100 transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-xs animate-pulse">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </Link>

            <Link href="/profile"><Button variant="ghost" size="sm"><User className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Profile</span></Button></Link>
            <button onClick={handleSignOut} className="flex items-center gap-1 sm:gap-2 text-secondary-500 hover:text-secondary-900 text-sm font-medium transition-colors">
              <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-10">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-secondary-900">
            Welcome back, {user.displayName?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="text-secondary-500 mt-1">Manage your bookings and saved professionals from your dashboard.</p>
        </div>

        {/* Live Unpaid Invoice Banner */}
        {unpaidBookings.length > 0 && (
          <div className="mb-8 p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-amber-950 text-sm sm:text-base flex items-center gap-2">
                  <span>Invoice Ready for Payment</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-200 text-amber-900">
                    Action Required
                  </span>
                </h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  Your booking with <strong>{unpaidBookings[0].providerName}</strong> for <strong>{unpaidBookings[0].service}</strong> was completed.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <Link href={`/payment/${unpaidBookings[0].id}`}>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-9 text-xs px-4 shadow-sm">
                  Pay {formatCurrency(Number(unpaidBookings[0].amount || 0), unpaidBookings[0].currency || "USD")} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <Link href="/search">
            <Card className="cursor-pointer hover:border-primary-500 hover:shadow-lg transition-all group border-transparent">
              <CardContent className="p-5 flex items-center gap-3.5">
                <div className="w-11 h-11 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-secondary-900 text-sm">Find Pros</h3>
                  <p className="text-xs text-secondary-500">Browse verified experts</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/favorites">
            <Card className="cursor-pointer hover:border-rose-400 hover:shadow-lg transition-all group border-transparent">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Heart className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-secondary-900 text-sm">Saved</h3>
                    <p className="text-xs text-secondary-500">Your favorites</p>
                  </div>
                </div>
                <div className="text-xl font-bold text-secondary-900">{savedCount}</div>
              </CardContent>
            </Card>
          </Link>

          <Card className="border-transparent shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-secondary-900 text-sm">Active</h3>
                  <p className="text-xs text-secondary-500">Upcoming bookings</p>
                </div>
              </div>
              <div className="text-xl font-bold text-secondary-900">{activeBookings}</div>
            </CardContent>
          </Card>

          <Link href="/payments">
            <Card className="cursor-pointer hover:border-emerald-500 hover:shadow-lg transition-all group border-transparent shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-secondary-900 text-sm">Payments</h3>
                    <p className="text-xs text-secondary-500">Receipts & spend</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-700">{formatCurrency(totalSpent, "USD")}</div>
                  <span className="text-[10px] text-secondary-400 font-medium">Total spent</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            {/* My Bookings */}
            <Card>
              <CardHeader className="border-b border-secondary-100 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    My Bookings
                    <span className="text-xs font-medium bg-secondary-100 text-secondary-600 px-2.5 py-1 rounded-full">
                      {allBookings.length} Total
                    </span>
                  </CardTitle>
                  
                  {/* Status Filter Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    {[
                      { id: "all", label: "All" },
                      { id: "pending", label: "Pending" },
                      { id: "active", label: "Active" },
                      { id: "completed", label: "Completed" },
                      { id: "cancelled", label: "Cancelled" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setBookingFilter(tab.id as any)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                          bookingFilter === tab.id
                            ? "bg-primary-600 text-white shadow-xs"
                            : "bg-secondary-100 text-secondary-600 hover:bg-secondary-200"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {allBookings.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center text-secondary-400">
                    <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mb-4">
                      <Clock className="w-8 h-8 text-secondary-300" />
                    </div>
                    <p className="font-medium text-secondary-900">No bookings yet</p>
                    <p className="text-sm mt-1 mb-4">You haven't booked any services on Promoh yet.</p>
                    <Link href="/search"><Button size="sm">Explore Services</Button></Link>
                  </div>
                ) : (
                  <div className="divide-y divide-secondary-100">
                    {allBookings
                      .filter((booking) => {
                        if (bookingFilter === "all") return true;
                        if (bookingFilter === "active") return booking.status === "accepted" || booking.status === "in_progress";
                        return booking.status === bookingFilter;
                      })
                      .map((booking, index) => (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        key={booking.id}
                        className="p-5 hover:bg-secondary-50 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-secondary-900">{booking.providerName}</span>
                              <Link href={`/provider/${booking.providerId}`} className="text-xs text-primary-600 hover:underline">
                                Profile
                              </Link>
                            </div>
                            <p className="text-sm text-secondary-600 font-medium">{booking.service}</p>
                            
                            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-secondary-500">
                              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{new Date(booking.date + "T12:00:00").toLocaleDateString()} at {booking.time}</span>
                              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{booking.address || "No address provided"}</span>
                            </div>

                            {/* Completion notes from provider */}
                            {booking.completionNotes && (
                              <div className="mt-2 text-xs text-secondary-600 bg-secondary-50 rounded-lg p-2.5 border border-secondary-200">
                                <span className="font-semibold text-secondary-800">Provider note:</span> {booking.completionNotes}
                              </div>
                            )}

                            {/* Live Booking Status Stepper */}
                            <div className="mt-4 pt-3 border-t border-secondary-100">
                              <BookingStatusStepper
                                status={booking.status}
                                paymentStatus={booking.paymentStatus}
                              />
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                            <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                              booking.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                              booking.status === 'accepted' ? 'bg-blue-100 text-blue-800' :
                              booking.status === 'in_progress' ? 'bg-indigo-100 text-indigo-800' :
                              booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {booking.status.replace("_", " ")}
                            </span>
                            
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {/* Chat Action */}
                              <Link href={`/chat?provider=${booking.providerId}`}>
                                <Button size="sm" variant="outline" className="h-8 px-2 text-secondary-600">
                                  <MessageSquare className="w-4 h-4 mr-1.5" /> Chat
                                </Button>
                              </Link>

                              {/* Book Again Action */}
                              {booking.status === 'completed' && (
                                <Link href={`/booking/new?provider=${booking.providerId}&service=${encodeURIComponent(booking.service || '')}`}>
                                  <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs text-primary-700 border-primary-200 hover:bg-primary-50">
                                    <CalendarCheck className="w-3.5 h-3.5 mr-1" /> Book Again
                                  </Button>
                                </Link>
                              )}

                              {/* Pay Action (if completed/accepted and unpaid) */}
                              {booking.status === 'completed' && booking.paymentStatus !== "paid" && (
                                <Link href={`/payment/${booking.id}`}>
                                  <Button size="sm" className="h-8 px-3 bg-green-600 hover:bg-green-700">
                                    <CreditCard className="w-4 h-4 mr-1.5" /> Pay Now
                                  </Button>
                                </Link>
                              )}

                              {/* Review Action */}
                              {booking.status === 'completed' && !booking.reviewed && (
                                <Button size="sm" className="h-8 px-3" onClick={() => setActiveReview(booking)}>
                                  <Star className="w-4 h-4 mr-1.5" /> Review
                                </Button>
                              )}

                              {/* Reschedule Action */}
                              {(booking.status === 'pending' || booking.status === 'accepted') && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                                  onClick={() => {
                                    setReschedulingBooking(booking);
                                    setRescheduleDate(booking.date || "");
                                    setRescheduleTime(booking.time || "");
                                    setRescheduleReason("");
                                  }}
                                >
                                  <Calendar className="w-3.5 h-3.5 mr-1" /> Reschedule
                                </Button>
                              )}

                              {/* Dispute / Get Help Action */}
                              <a href={`mailto:promoh321@gmail.com?subject=Help%20with%20Booking%20${booking.id}&body=Hi%20Promoh%20Support,%0D%0A%0D%0AI%20need%20help%20with%20my%20booking%20(ID:%20${booking.id})%20with%20${encodeURIComponent(booking.providerName || "provider")}.%0D%0A%0D%0AIssue:%0D%0A`}>
                                <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-secondary-400 hover:text-secondary-700" title="Contact Support about this booking">
                                  <LifeBuoy className="w-3.5 h-3.5 mr-1" /> Help
                                </Button>
                              </a>

                              {/* Cancel Action */}
                              {booking.status === 'pending' && (
                                <Button size="sm" variant="ghost" className="h-8 px-2 text-red-500 hover:bg-red-50 hover:text-red-700" onClick={() => setCancellingBooking(booking)}>
                                  <XCircle className="w-4 h-4 mr-1.5" /> Cancel
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Account Info */}
            <Card>
              <CardHeader className="pb-3 border-b border-secondary-100">
                <CardTitle className="text-lg">My Account</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-400 to-indigo-500 flex items-center justify-center text-white text-xl font-bold shadow-sm">
                    {(user.displayName || user.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-secondary-900 truncate">{user.displayName || "Customer"}</h3>
                    <p className="text-secondary-500 text-sm truncate">{user.email}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full mt-1.5">
                      <ShieldCheck className="w-3 h-3" /> Customer
                    </span>
                  </div>
                </div>
                <div className="border-t border-secondary-100 pt-3 space-y-2 text-sm">
                  <div className="flex justify-between text-secondary-600">
                    <span>Member Since</span>
                    <span className="font-medium text-secondary-900">{userData?.createdAt ? new Date(userData.createdAt).getFullYear() : new Date().getFullYear()}</span>
                  </div>
                  <Link href="/profile" className="block pt-2">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      <Settings className="w-3.5 h-3.5 mr-1.5" /> Edit Profile & Settings
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Need Help */}
            <Card className="bg-gradient-to-br from-primary-600 to-indigo-700 text-white border-transparent overflow-hidden relative">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <CardContent className="p-6 relative z-10">
                <h3 className="text-lg font-bold mb-2">Need Assistance?</h3>
                <p className="text-primary-100 text-sm mb-4">Our customer support team is here to assist you with bookings and questions.</p>
                <div className="space-y-2">
                  <a href="mailto:promoh321@gmail.com?subject=Customer%20Support%20Assistance" className="block">
                    <Button className="w-full bg-white text-primary-700 hover:bg-primary-50 font-semibold shadow-md">
                      Contact Support
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {activeReview && (
        <ReviewModal
          bookingId={activeReview.id}
          providerId={activeReview.providerId}
          customerId={user.uid}
          customerName={user.displayName || "Customer"}
          onClose={() => setActiveReview(null)}
          onSuccess={() => setActiveReview(null)}
        />
      )}

      {/* Reschedule Booking Modal */}
      <AnimatePresence>
        {reschedulingBooking && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setReschedulingBooking(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-secondary-100"
            >
              <div className="flex items-center justify-between pb-4 border-b mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-secondary-900 text-lg">Reschedule Service</h3>
                    <p className="text-xs text-secondary-500">{reschedulingBooking.service}</p>
                  </div>
                </div>
                <button
                  onClick={() => setReschedulingBooking(null)}
                  className="p-1 rounded-full text-secondary-400 hover:text-secondary-700 hover:bg-secondary-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-secondary-50 rounded-xl text-xs text-secondary-600">
                  <p>Currently scheduled for: <strong className="text-secondary-900">{reschedulingBooking.date} at {reschedulingBooking.time}</strong></p>
                  <p className="text-secondary-500 mt-0.5">With: {reschedulingBooking.providerName}</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-secondary-700 uppercase tracking-wider block mb-1.5">
                    New Date
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-secondary-700 uppercase tracking-wider block mb-1.5">
                    New Time Slot
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {TIME_SLOTS.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setRescheduleTime(slot)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                          rescheduleTime === slot
                            ? "bg-primary-600 text-white border-primary-600 shadow-xs"
                            : "bg-white text-secondary-700 border-secondary-200 hover:border-primary-400"
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-secondary-700 uppercase tracking-wider block mb-1.5">
                    Reason for Reschedule (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Work emergency, change of plans..."
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 mt-6 pt-4 border-t">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setReschedulingBooking(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={!rescheduleDate || !rescheduleTime}
                  isLoading={rescheduleLoading}
                  onClick={handleConfirmReschedule}
                >
                  Confirm New Date
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {cancellingBooking && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setCancellingBooking(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-secondary-100"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-bold text-secondary-900 mb-2">
                Cancel this booking?
              </h3>
              <p className="text-sm text-secondary-600 mb-4">
                Are you sure you want to cancel your booking for <strong>{cancellingBooking.service}</strong> with <strong>{cancellingBooking.providerName}</strong> on {cancellingBooking.date}?
              </p>

              <div className="mb-5">
                <label className="text-xs font-bold text-secondary-700 uppercase tracking-wider block mb-2">
                  Cancellation Reason
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 border border-secondary-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="Schedule conflict">Schedule conflict</option>
                  <option value="Found alternative service">Found alternative service</option>
                  <option value="Booked by mistake">Booked by mistake</option>
                  <option value="Cost concerns">Cost concerns</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex gap-2.5">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setCancellingBooking(null)}
                >
                  No, Keep It
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  isLoading={cancellingLoading}
                  onClick={handleConfirmCancel}
                >
                  Yes, Cancel Booking
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
