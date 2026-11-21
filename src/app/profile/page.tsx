"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase/client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { COUNTRIES } from "@/lib/currencies";
import {
  User, Camera, Lock, ArrowLeft, CheckCircle2,
  AlertCircle, ShieldCheck, Phone, Globe, Upload
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import PhoneInput from "@/components/ui/PhoneInput";
import { uploadImageWithFallback } from "@/lib/imageUtils";

const IMGBB_KEY = process.env.NEXT_PUBLIC_IMGBB_KEY || "3a8672d6f05b114ce3c0c6e81c8bd9fe";

export default function CustomerProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pwMessage, setPwMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);

  // Initialize with auth user defaults immediately
  const [form, setForm] = useState({
    displayName: user?.displayName || "",
    phone: "",
    country: "US",
    dialCode: "+1",
    photoURL: user?.photoURL || "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Keep form in sync when auth state initializes
  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        displayName: prev.displayName || user.displayName || "",
        photoURL: prev.photoURL || user.photoURL || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    async function loadData() {
      if (!user?.uid) return;
      try {
        let data: any = null;

        // 1. Try checking users collection
        const userSnap = await getDoc(doc(db, "users", user.uid)).catch(() => null);
        if (userSnap && userSnap.exists()) {
          data = userSnap.data();
        } else {
          // 2. Fall back to providers collection if registered as provider
          const providerSnap = await getDoc(doc(db, "providers", user.uid)).catch(() => null);
          if (providerSnap && providerSnap.exists()) {
            data = providerSnap.data();
          }
        }

        let initialCountry = data?.country || "US";
        let initialDialCode = "+1";
        let rawPhone = data?.phone || "";

        // If phone has a dial code prefix, extract it accurately
        if (rawPhone.startsWith("+")) {
          for (const c of COUNTRIES) {
            if (rawPhone.startsWith(c.dialCode)) {
              initialCountry = c.code;
              initialDialCode = c.dialCode;
              rawPhone = rawPhone.slice(c.dialCode.length).trim();
              break;
            }
          }
        } else {
          const cObj = COUNTRIES.find((c) => c.code === initialCountry);
          if (cObj) initialDialCode = cObj.dialCode;
        }

        setForm({
          displayName:
            data?.displayName ||
            `${data?.firstName || ""} ${data?.lastName || ""}`.trim() ||
            data?.businessName ||
            user.displayName ||
            "",
          phone: rawPhone,
          country: initialCountry,
          dialCode: initialDialCode,
          photoURL: data?.photoURL || user.photoURL || "",
        });
      } catch (err) {
        // Fall back gracefully to user Auth object if Firestore is temporarily offline
        setForm((prev) => ({
          ...prev,
          displayName: prev.displayName || user.displayName || "",
          photoURL: prev.photoURL || user.photoURL || "",
        }));
      } finally {
        setLoading(false);
      }
    }

    if (user?.uid) {
      loadData();
    }
  }, [user, authLoading, router]);

  const handleCountryChange = (countryCode: string) => {
    const c = COUNTRIES.find((item) => item.code === countryCode);
    setForm((prev) => ({
      ...prev,
      country: countryCode,
      dialCode: c?.dialCode || prev.dialCode,
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    setUploadingPhoto(true);
    setMessage(null);
    try {
      // Bulletproof upload with client compression & fallback
      const { url } = await uploadImageWithFallback(file, { maxWidth: 600, maxHeight: 600 });
      setForm((prev) => ({ ...prev, photoURL: url }));

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: url }).catch(() => {});
      }

      // Save safely with merge: true to users collection
      await setDoc(doc(db, "users", user.uid), { photoURL: url }, { merge: true });

      // If provider, also update providers collection
      if (user.role === "provider") {
        await setDoc(doc(db, "providers", user.uid), { photoURL: url }, { merge: true });
      }

      setMessage({ text: "Profile photo updated successfully!", ok: true });
    } catch (err) {
      setMessage({ text: "Error uploading image. Please check your image format and try again.", ok: false });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;

    setSavingProfile(true);
    setMessage(null);
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: form.displayName }).catch(() => {});
      }

      const countryData = COUNTRIES.find((c) => c.code === form.country);

      // Save to users collection with merge: true
      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: form.displayName,
          phone: form.phone,
          country: form.country,
          currency: countryData?.currency || "USD",
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // If provider, also update providers collection
      if (user.role === "provider") {
        await setDoc(
          doc(db, "providers", user.uid),
          {
            businessName: form.displayName,
            phone: form.phone,
            country: form.country,
            currency: countryData?.currency || "USD",
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      setMessage({ text: "Profile details saved successfully!", ok: true });
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to update profile.", ok: false });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);

    if (passwordForm.newPassword.length < 8) {
      setPwMessage({ text: "New password must be at least 8 characters long.", ok: false });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPwMessage({ text: "New passwords do not match.", ok: false });
      return;
    }

    if (!user?.email || !auth.currentUser) return;

    setSavingPassword(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, passwordForm.currentPassword);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, passwordForm.newPassword);

      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPwMessage({ text: "Password changed successfully!", ok: true });
    } catch (err: any) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setPwMessage({ text: "Current password is incorrect.", ok: false });
      } else {
        setPwMessage({ text: err.message || "Failed to update password.", ok: false });
      }
    } finally {
      setSavingPassword(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-50 pb-20">
      <nav className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href={user?.role === "provider" ? "/provider/dashboard" : "/dashboard"}
            className="flex items-center gap-2 text-secondary-600 hover:text-secondary-900 font-medium text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-secondary-900">
              {form.displayName || user?.displayName || user?.email}
            </span>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-secondary-900">Profile & Settings</h1>
          <p className="text-secondary-500 mt-1">Manage your personal information, contact info, and security credentials.</p>
        </div>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <User className="w-5 h-5 text-primary-600" /> Personal Details
            </CardTitle>
            <CardDescription>Update your display name, profile avatar, and contact number.</CardDescription>
          </CardHeader>
          <CardContent>
            {message && (
              <div
                className={`p-3 rounded-xl mb-6 text-sm flex items-center gap-2 border ${
                  message.ok
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}
              >
                {message.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {message.text}
              </div>
            )}

            {/* Photo Avatar */}
            <div className="flex items-center gap-5 pb-6 border-b border-secondary-100">
              <div className="relative group">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-indigo-500 overflow-hidden flex items-center justify-center text-white text-2xl font-bold shadow-md relative">
                  {form.photoURL ? (
                    <Image
                      src={form.photoURL}
                      alt="Avatar"
                      width={80}
                      height={80}
                      unoptimized
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (form.displayName || user?.email || "?")[0].toUpperCase()
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-white shadow-md border border-secondary-200 text-secondary-700 hover:text-primary-600 transition-colors"
                  title="Change photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
              <div>
                <h4 className="font-semibold text-secondary-900 text-sm">Profile Picture</h4>
                <p className="text-xs text-secondary-500 mt-0.5">JPG, PNG or WebP. Max 5MB.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="mt-2 text-xs h-8"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  {uploadingPhoto ? "Uploading..." : "Upload New Photo"}
                </Button>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 pt-6">
              <div>
                <label className="text-sm font-medium text-secondary-700 block mb-1">Display Name</label>
                <Input
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  required
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-secondary-700 block mb-1">Email Address</label>
                <Input
                  value={user?.email || ""}
                  disabled
                  className="bg-secondary-50 text-secondary-500 cursor-not-allowed"
                />
                <p className="text-[11px] text-secondary-400 mt-1">Contact support if you need to change your registered email.</p>
              </div>

              <div>
                <label className="text-sm font-medium text-secondary-700 block mb-1">Phone Number (Global)</label>
                <PhoneInput
                  country={form.country}
                  phoneNumber={form.phone}
                  onCountryChange={(code, dial) =>
                    setForm((prev) => ({ ...prev, country: code, dialCode: dial }))
                  }
                  onPhoneChange={(val) => setForm((prev) => ({ ...prev, phone: val }))}
                  placeholder="555 0199"
                />
                <p className="text-[11px] text-secondary-400 mt-1">
                  Click the country flag to select any of the 240+ countries and territories worldwide.
                </p>
              </div>

              <div className="pt-2">
                <Button type="submit" isLoading={savingProfile}>
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Security / Password Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary-600" /> Change Password
            </CardTitle>
            <CardDescription>Ensure your account is protected with a secure password.</CardDescription>
          </CardHeader>
          <CardContent>
            {pwMessage && (
              <div
                className={`p-3 rounded-xl mb-6 text-sm flex items-center gap-2 border ${
                  pwMessage.ok
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}
              >
                {pwMessage.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {pwMessage.text}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-secondary-700 block mb-1">Current Password</label>
                <Input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  required
                  placeholder="••••••••"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-secondary-700 block mb-1">New Password</label>
                  <Input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    required
                    placeholder="Min 8 characters"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-secondary-700 block mb-1">Confirm New Password</label>
                  <Input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    required
                    placeholder="Repeat new password"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" variant="outline" isLoading={savingPassword}>
                  Update Password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
