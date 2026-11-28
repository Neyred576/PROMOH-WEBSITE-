import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // Max 3 purge attempts per 15 minutes per IP
    const limit = rateLimit(`admin-purge-${ip}`, 3, 15 * 60 * 1000);
    if (!limit.success) {
      return NextResponse.json(
        { error: "Too many purge requests. Cooldown active." },
        { status: 429 }
      );
    }

    const { password } = await req.json();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      console.error("ADMIN_PASSWORD environment variable is not set.");
      return NextResponse.json(
        { error: "Server configuration error: ADMIN_PASSWORD is not set." },
        { status: 500 }
      );
    }

    if (!password || password !== adminPassword) {
      return NextResponse.json(
        { error: "Incorrect admin password. Deletion unauthorized." },
        { status: 401 }
      );
    }

    let authDeletedCount = 0;

    // 1. Attempt to purge users in Firebase Authentication via Admin SDK (if configured)
    try {
      if (adminAuth) {
        let nextPageToken: string | undefined;
        do {
          const listUsersResult = await adminAuth.listUsers(1000, nextPageToken);
          const uidsToDelete = listUsersResult.users
            .filter(
              (user) =>
                user.email !== "admin@promoh.com" &&
                user.email !== "superadmin@promoh.com"
            )
            .map((user) => user.uid);

          if (uidsToDelete.length > 0) {
            const deleteResult = await adminAuth.deleteUsers(uidsToDelete);
            authDeletedCount += deleteResult.successCount;
          }
          nextPageToken = listUsersResult.pageToken;
        } while (nextPageToken);
      }
    } catch (authError: any) {
      console.warn("Firebase Admin Auth purge warning (skipped):", authError?.message || authError);
    }

    // 2. Attempt to purge Firestore collections using Admin SDK (if configured)
    try {
      if (adminDb) {
        const collectionsToPurge = [
          "providers",
          "bookings",
          "reviews",
          "notifications",
          "reports",
          "disputes",
          "chats",
          "adminChats",
          "digital_requests",
          "payouts",
        ];

        for (const colName of collectionsToPurge) {
          const snap = await adminDb.collection(colName).get();
          if (!snap.empty) {
            const batch = adminDb.batch();
            snap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }

        // For users collection, preserve the administrator accounts
        const usersSnap = await adminDb.collection("users").get();
        if (!usersSnap.empty) {
          const batch = adminDb.batch();
          let count = 0;
          usersSnap.docs.forEach((d) => {
            const data = d.data();
            if (
              data.role !== "admin" &&
              data.email !== "admin@promoh.com" &&
              data.email !== "superadmin@promoh.com"
            ) {
              batch.delete(d.ref);
              count++;
            }
          });
          if (count > 0) {
            await batch.commit();
          }
        }
      }
    } catch (dbError: any) {
      console.warn("Firebase Admin DB purge warning (client handles fallback):", dbError?.message || dbError);
    }

    return NextResponse.json({
      success: true,
      message: "Admin credentials verified and purge executed.",
      authDeletedCount,
    });
  } catch (error: any) {
    console.error("Purge error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process purge request." },
      { status: 500 }
    );
  }
}
