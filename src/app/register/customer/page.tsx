"use client";

import { useState, useEffect, useRef } from "react";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, setDoc, getDoc, query, collection, where, getDocs } from "firebase/firestore";
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



function validatePassword(password: string) {
  return [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "Uppercase letter (A-Z)", ok: /[A-Z]/.test(password) },
    { label: "Lowercase letter (a-z)", ok: /[a-z]/.test(password) },
    { label: "Number (0-9)", ok: /[0-9]/.test(password) },
    { label: "Special character (!@#$...)", ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

export default function CustomerRegisterPage() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "", country: "US" });
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

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const countryData = COUNTRIES.find(c => c.code === form.country);
      const fullName = `${form.firstName} ${form.lastName}`.trim();

      // Ensure profile and doc are saved before routing
      await updateProfile(cred.user, { displayName: fullName }).catch(() => {});
      await setDoc(doc(db, "users", cred.user.uid), {
        displayName: fullName,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone ? `${countryData?.dialCode || ""} ${form.phone}`.trim() : "",
        country: form.country,
        currency: countryData?.currency || "USD",
        role: "customer",
        emailVerified: false,
        createdAt: new Date().toISOString(),
        isOnline: true,
      }, { merge: true });

      sendEmailVerification(cred.user).catch(() => {});
      window.location.href = "/dashboard";
    } catch (err: any) {
      const msgs: Record<string, string> = {
        "auth/email-already-in-use": "An account with this email already exists.",
        "auth/weak-password": "Password is too weak. Please use a stronger password.",
        "auth/network-request-failed": "Network error. Please check your internet connection.",
        "auth/operation-not-allowed": "Email sign-up is not enabled. Please contact support.",
        "permission-denied": "Cloud Firestore database needs to be enabled in Firebase Console.",
      };
      setError(msgs[err.code] || (err.message?.includes("PERMISSION_DENIED") ? "Cloud Firestore needs to be enabled in Firebase Console." : err.message?.includes("timed out") ? "Request timed out. Please try again." : "Registration failed. Please try again."));
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setError("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(auth, provider);
      const userRef = doc(db, "users", cred.user.uid);
      const userDoc = await getDoc(userRef).catch(() => null);
      if (!userDoc || !userDoc.exists()) {
        const countryData = COUNTRIES.find(c => c.code === form.country);
        const nameParts = (cred.user.displayName || "Customer").split(" ");
        await setDoc(userRef, {
          displayName: cred.user.displayName || "Customer",
          firstName: nameParts[0] || "Customer",
          lastName: nameParts.slice(1).join(" ") || "",
          email: cred.user.email,
          country: form.country || "US",
          currency: countryData?.currency || "USD",
          role: "customer",
          emailVerified: true,
          createdAt: new Date().toISOString(),
          isOnline: true,
        }, { merge: true });
      }
      window.location.href = "/dashboard";
    } catch (err: any) {
      console.error("Google sign up error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-up popup closed before completing. If you are using Incognito mode or have third-party cookies disabled, please allow popups/cookies or sign up with email.");
      } else if (err.code === "auth/unauthorized-domain") {
        setError("Domain not authorized in Firebase Console. Please add localhost to Firebase Auth Authorized Domains.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("Google Sign-In is not enabled in Firebase Console.");
      } else {
        setError(err.message || "Failed to continue with Google.");
      }
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4 py-12">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <Link href="/"><Image src="/logo.png" alt="Promoh" width={56} height={56} className="w-auto h-12" /></Link>
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Create Customer Account</CardTitle>
            <CardDescription>Join Promoh to find trusted professionals</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-200">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium block mb-1">First Name</label><Input value={form.firstName} onChange={set("firstName")} required placeholder="John" /></div>
                <div><label className="text-sm font-medium block mb-1">Last Name</label><Input value={form.lastName} onChange={set("lastName")} required placeholder="Doe" /></div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Email</label>
                <div className="relative">
                  <Input type="email" value={form.email} onChange={set("email")} required placeholder="name@example.com" />
                  {emailStatus === "checking" && (
                    <span className="absolute right-3 top-2.5 text-secondary-400 text-xs flex items-center gap-1">
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
                    <Link href="/login" className="underline font-bold text-primary-600">
                      Log in instead
                    </Link>
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Phone Number (Global)</label>
                <PhoneInput
                  country={form.country}
                  phoneNumber={form.phone}
                  onCountryChange={(code) => setForm(prev => ({ ...prev, country: code }))}
                  onPhoneChange={(val) => setForm(prev => ({ ...prev, phone: val }))}
                  placeholder="555 0199"
                  required
                />
                <p className="text-[10px] text-secondary-400 mt-1">
                  Click the flag to choose from all 240+ countries & territories worldwide.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Password</label>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} value={form.password} onChange={set("password")} required className="pr-12" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary-400">
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {form.password && (
                  <div className="mt-2 space-y-1">
                    {pwRules.map(rule => (
                      <div key={rule.label} className={`flex items-center gap-2 text-xs ${rule.ok ? "text-green-600" : "text-secondary-400"}`}>
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${rule.ok ? "bg-green-500 border-green-500" : "border-secondary-300"}`}>
                          {rule.ok && <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        {rule.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div><label className="text-sm font-medium block mb-1">Confirm Password</label><Input type="password" value={form.confirmPassword} onChange={set("confirmPassword")} required /></div>
              <Button type="submit" className="w-full mt-2" isLoading={loading}>Create Account</Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-secondary-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-secondary-500 font-medium">Or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleRegister}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 border-secondary-200 hover:bg-secondary-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Sign up with Google
            </Button>
            <p className="text-center mt-4 text-sm text-secondary-500">
              Already have an account? <Link href="/login" className="text-primary-600 font-medium hover:underline">Log in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
