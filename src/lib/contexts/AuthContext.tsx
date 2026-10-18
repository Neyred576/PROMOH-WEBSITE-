"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  User as FirebaseUser,
  signOut as firebaseSignOut
} from "firebase/auth";
import { auth, getDb } from "@/lib/firebase/client";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export type UserRole = "customer" | "provider" | "admin";

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  isVerified?: boolean;
  suspended?: boolean;
  banned?: boolean;
  currency?: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          const db = getDb();
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          let role: UserRole = "customer";
          let isVerified = false;
          let suspended = false;
          let banned = false;
          let currency = "USD";

          if (userDoc.exists()) {
            const data = userDoc.data();
            role = data.role || "customer";
            isVerified = data.isVerified || false;
            suspended = data.suspended || false;
            banned = data.banned || false;
            currency = data.currency || "USD";

            // If banned, sign out immediately
            if (banned) {
              await firebaseSignOut(auth);
              setUser(null);
              setLoading(false);
              if (typeof window !== "undefined") {
                window.location.href = "/banned";
              }
              return;
            }
          } else {
            // Check providers collection
            const providerDoc = await getDoc(doc(db, "providers", firebaseUser.uid));
            if (providerDoc.exists()) {
              const data = providerDoc.data();
              role = "provider";
              isVerified = data.isVerified || false;
              suspended = data.suspended || false;
              banned = data.banned || false;
              currency = data.currency || "USD";

              if (banned) {
                await firebaseSignOut(auth);
                setUser(null);
                setLoading(false);
                if (typeof window !== "undefined") {
                  window.location.href = "/banned";
                }
                return;
              }
            }
          }

          // Mark user as online in Firestore
          updateDoc(doc(db, "users", firebaseUser.uid), {
            isOnline: true,
            lastSeen: new Date().toISOString(),
          }).catch(() => {});

          if (role === "provider") {
            updateDoc(doc(db, "providers", firebaseUser.uid), {
              isOnline: true,
              lastSeen: new Date().toISOString(),
            }).catch(() => {});
          }

          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role,
            isVerified,
            suspended,
            banned,
            currency,
          });
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role: "customer",
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    if (user?.uid) {
      try {
        const db = getDb();
        await updateDoc(doc(db, "users", user.uid), {
          isOnline: false,
          lastSeen: new Date().toISOString(),
        }).catch(() => {});

        if (user.role === "provider") {
          await updateDoc(doc(db, "providers", user.uid), {
            isOnline: false,
            lastSeen: new Date().toISOString(),
          }).catch(() => {});
        }
      } catch (e) {
        // continue signing out
      }
    }
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
