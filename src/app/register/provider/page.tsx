"use client";

import { useState, useEffect, useRef } from "react";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, query, collection, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { COUNTRIES } from "@/lib/currencies";
import PhoneInput from "@/components/ui/PhoneInput";

const SERVICE_CATEGORIES = ["Electricians", "Plumbers", "Cleaners", "Tutors", "Photographers", "Mechanics", "Carpenters", "Painters", "Movers", "Beauty Professionals", "IT Specialists", "Home Repair", "Other"];



function validatePassword(password: string) {
  return [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "Uppercase letter (A-Z)", ok: /[A-Z]/.test(password) },
    { label: "Lowercase letter (a-z)", ok: /[a-z]/.test(password) },
    { label: "Number (0-9)", ok: /[0-9]/.test(password) },
    { label: "Special character (!@#$...)", ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

export default function ProviderRegisterPage() {
  const [form, setForm] = useState({
    firstName: "", lastName: "", businessName: "", email: "", phone: "",
    password: "", confirmPassword: "", country: "US", city: "", serviceCategory: ""
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const emailTimerRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  const pwRules = validatePassword(form.password);
  const pwValid = pwRules.every(r => r.ok);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setForm(prev => ({ ...prev, [field]: val }));

    if (field === "email") {
      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
      if (!val || !val.includes("@") || !val.includes(".")) {
        setEmailStatus("idle");
        return;
      }
      setEmailStatus("checking");
      emailTimerRef.current = setTimeout(async () => {
        try {
          const q = query(collection(db, "users"), where("email", "==", val.trim().toLowerCase()));
          const snap = await getDocs(q);
          setEmailStatus(snap.empty ? "available" : "taken");
        } catch {
          setEmailStatus("idle");
        }
      }, 500);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!pwValid) { setError("Please meet all password requirements."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (!form.country || !form.serviceCategory) { setError("Please select your country and service category."); return; }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const countryData = COUNTRIES.find(c => c.code === form.country);
      const fullName = `${form.firstName} ${form.lastName}`.trim();
      const displayName = form.businessName || fullName;

      // Ensure profile and docs are saved before routing
      await updateProfile(cred.user, { displayName }).catch(() => {});
      
      await setDoc(doc(db, "users", cred.user.uid), {
        displayName,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone ? `${countryData?.dialCode || ""} ${form.phone}`.trim() : "",
        country: form.country,
        currency: countryData?.currency || "USD",
        role: "provider",
        emailVerified: false,
        createdAt: new Date().toISOString(),
        isOnline: true,
      }, { merge: true });

      await setDoc(doc(db, "providers", cred.user.uid), {
        businessName: form.businessName,
        displayName,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone ? `${countryData?.dialCode || ""} ${form.phone}`.trim() : "",
        country: form.country,
        location: `${form.city}, ${countryData?.name || form.country}`,
        currency: countryData?.currency || "USD",
        servicesOffered: form.serviceCategory,
        isVerified: false,
        status: "Pending",
        isFeatured: false,
        isOnline: true,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      sendEmailVerification(cred.user).catch(() => {});
      window.location.href = "/provider/dashboard";
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError("An account with this email already exists.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("Email/Password sign-in is not enabled. Go to Firebase Console → Authentication → Sign-in method.");
      } else if (err.code === "auth/invalid-api-key" || err.message?.includes("api-key-not-valid")) {
        setError("Firebase configuration error. Check your .env.local file.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Please use a stronger password.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection.");
      } else if (err.code === "permission-denied" || err.message?.includes("PERMISSION_DENIED")) {
        setError("Cloud Firestore database needs to be enabled in Firebase Console. Please ensure Firestore is created.");
      } else if (err.message?.includes("timed out")) {
        setError("Request timed out. Please check your internet connection and try again.");
      } else {
        setError("Registration failed. Please try again.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="flex justify-center mb-8">
          <Link href="/"><Image src="/logo.png" alt="Promoh" width={56} height={56} className="w-auto h-12 " /></Link>
        </div>
        <Card className="bg-white border-secondary-200 text-secondary-900 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-secondary-900">Apply as a Service Provider</CardTitle>
            <CardDescription className="text-secondary-500">Join thousands of verified professionals on Promoh</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-200">{error}</div>}

              <div className="dark-input">
                <label className="text-sm font-medium text-secondary-700 block mb-1">Business / Trading Name</label>
                <Input value={form.businessName} onChange={set("businessName")} required placeholder="e.g. John's Electrical Services"
                  className="bg-white border-secondary-300 text-secondary-900 placeholder:text-secondary-400 focus-visible:ring-primary-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-secondary-700 block mb-1">First Name</label>
                  <Input value={form.firstName} onChange={set("firstName")} required placeholder="John"
                    className="bg-white border-secondary-300 text-secondary-900 placeholder:text-secondary-400 focus-visible:ring-primary-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-secondary-700 block mb-1">Last Name</label>
                  <Input value={form.lastName} onChange={set("lastName")} required placeholder="Doe"
                    className="bg-white border-secondary-300 text-secondary-900 placeholder:text-secondary-400 focus-visible:ring-primary-500" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-secondary-700 block mb-1">Email Address</label>
                <div className="relative">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    required
                    placeholder="contact@yourbusiness.com"
                    className="bg-white border-secondary-300 text-secondary-900 placeholder:text-secondary-400 focus-visible:ring-primary-500"
                  />
                  {emailStatus === "checking" && (
                    <span className="absolute right-3 top-3 text-secondary-400 text-xs flex items-center gap-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    </span>
                  )}
                </div>
                {emailStatus === "available" && (
                  <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1 font-medium">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Email is available
                  </p>
                )}
                {emailStatus === "taken" && (
                  <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> An account with this email already exists.{" "}
                    <Link href="/provider/login" className="underline font-bold text-primary-600">
                      Log in instead
                    </Link>
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-secondary-700 block mb-1">Phone Number (Global)</label>
                <PhoneInput
                  country={form.country}
                  phoneNumber={form.phone}
                  onCountryChange={(code) => setForm((prev) => ({ ...prev, country: code }))}
                  onPhoneChange={(val) => setForm((prev) => ({ ...prev, phone: val }))}
                  placeholder="555 0199"
                  required
                />
                <p className="text-[10px] text-secondary-400 mt-1">
                  Click the country flag to select any of the 240+ countries and territories worldwide.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-secondary-700 block mb-1">Country</label>
                  <select value={form.country} onChange={set("country")} required
                    className="flex h-12 w-full rounded-xl border bg-white border-secondary-300 text-secondary-900 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-secondary-700 block mb-1">City</label>
                  <Input value={form.city} onChange={set("city")} required placeholder="Your City"
                    className="bg-white border-secondary-300 text-secondary-900 placeholder:text-secondary-400 focus-visible:ring-primary-500" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-secondary-700 block mb-1">Service Category</label>
                <select value={form.serviceCategory} onChange={set("serviceCategory")} required
                  className="flex h-12 w-full rounded-xl border bg-white border-secondary-300 text-secondary-900 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                  <option value="">Select your primary service</option>
                  {SERVICE_CATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-secondary-700 block mb-1">Password</label>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} value={form.password} onChange={set("password")} required
                    className="bg-white border-secondary-300 text-secondary-900 focus-visible:ring-primary-500 pr-12" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600">
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {form.password && (
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {pwRules.map(rule => (
                      <div key={rule.label} className={`flex items-center gap-1.5 text-xs ${rule.ok ? "text-green-600" : "text-secondary-400"}`}>
                        <div className={`w-3 h-3 rounded-full flex items-center justify-center ${rule.ok ? "bg-green-500" : "border border-secondary-300"}`}>
                          {rule.ok && <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        {rule.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-secondary-700 block mb-1">Confirm Password</label>
                <Input type="password" value={form.confirmPassword} onChange={set("confirmPassword")} required
                  className="bg-white border-secondary-300 text-secondary-900 focus-visible:ring-primary-500" />
              </div>

              <Button type="submit" className="w-full mt-2" isLoading={loading}>
                Submit Application
              </Button>
            </form>
            <p className="text-center mt-4 text-sm text-secondary-500">
              Already registered? <Link href="/provider/login" className="text-primary-600 font-medium hover:underline">Log in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
