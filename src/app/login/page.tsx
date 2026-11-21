"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "@/lib/firebase/client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, AlertCircle } from "lucide-react";



export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Redirect already-authenticated users away from the login page
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === "admin") window.location.href = "/admin/dashboard";
      else if (user.role === "provider") window.location.href = "/provider/dashboard";
      else window.location.href = "/dashboard";
    }
  }, [user, authLoading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      try {
        const userDoc = await getDoc(doc(db, "users", cred.user.uid));
        const role = userDoc.exists() ? userDoc.data().role : "customer";
        if (role === "admin") {
          document.cookie = "admin_session=authenticated; path=/; max-age=28800; SameSite=Strict";
          window.location.href = "/admin/dashboard";
        } else if (role === "provider") {
          window.location.href = "/provider/dashboard";
        } else {
          window.location.href = "/dashboard";
        }
      } catch {
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      const msgs: Record<string, string> = {
        "auth/user-not-found": "No account found with this email.",
        "auth/wrong-password": "Incorrect password. Please try again.",
        "auth/invalid-credential": "Invalid email or password.",
        "auth/too-many-requests": "Too many failed attempts. Please try again later.",
        "auth/invalid-api-key": "Service configuration error. Please contact support.",
        "auth/operation-not-allowed": "Email sign-in is not enabled.",
        "auth/network-request-failed": "Network error. Check your internet connection.",
      };
      setError(msgs[err.code] || "Login failed. Please verify your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(auth, provider);
      const userRef = doc(db, "users", cred.user.uid);
      const userDoc = await getDoc(userRef).catch(() => null);
      if (!userDoc || !userDoc.exists()) {
        await setDoc(userRef, {
          email: cred.user.email,
          displayName: cred.user.displayName || "Customer",
          role: "customer",
          createdAt: new Date().toISOString(),
          isOnline: true,
        }, { merge: true });
        window.location.href = "/dashboard";
      } else {
        const role = userDoc.data().role;
        if (role === "admin") {
          document.cookie = "admin_session=authenticated; path=/; max-age=28800; SameSite=Strict";
          window.location.href = "/admin/dashboard";
        }
        else if (role === "provider") window.location.href = "/provider/dashboard";
        else window.location.href = "/dashboard";
      }
    } catch (err: any) {
      console.error("Google sign in error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in popup closed before completing. If you are using Incognito mode or have third-party cookies disabled, please allow popups/cookies or log in with email.");
      } else if (err.code === "auth/unauthorized-domain") {
        setError("Domain not authorized in Firebase Console. Please add localhost to Firebase Auth Authorized Domains.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("Google Sign-In is not enabled in Firebase Console.");
      } else {
        setError(err.message || "Failed to sign in with Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/"><Image src="/logo.png" alt="Promoh" width={56} height={56} className="w-auto h-12" /></Link>
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Log in to your Promoh account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}
              <div>
                <label className="text-sm font-medium block mb-1">Email Address</label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="name@example.com" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">Password</label>
                  <Link href="/forgot-password" className="text-sm text-primary-600 hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required className="pr-12" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary-400">
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" isLoading={loading}>Log In</Button>
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
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 border-secondary-200 hover:bg-secondary-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Sign in with Google
            </Button>

            <div className="mt-6 text-center text-sm text-secondary-600 space-y-2">
              <p>Don't have an account? <Link href="/register" className="text-primary-600 font-medium hover:underline">Sign Up</Link></p>
              <p><Link href="/provider/login" className="text-secondary-400 hover:text-secondary-700 transition-colors">I'm a Service Provider →</Link></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
