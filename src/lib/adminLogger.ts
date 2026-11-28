import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export type AdminActionType =
  | "PROVIDER_APPROVED"
  | "PROVIDER_REJECTED"
  | "USER_BANNED"
  | "USER_UNBANNED"
  | "USER_DELETED"
  | "DISPUTE_REFUNDED"
  | "DISPUTE_RELEASED"
  | "DISPUTE_WARNED"
  | "NOTIFICATION_BROADCAST"
  | "PROMO_CREATED"
  | "PROMO_TOGGLED"
  | "PROMO_DELETED"
  | "REVIEW_DELETED"
  | "SETTINGS_UPDATED"
  | "BOOKING_STATUS_OVERRIDE"
  | "ALL_USERS_PURGED";

export interface AdminAuditLog {
  id?: string;
  action: AdminActionType;
  targetId?: string;
  targetName?: string;
  targetType?: "customer" | "provider" | "booking" | "review" | "promo" | "broadcast" | "settings";
  details: string;
  adminEmail?: string;
  timestamp?: any;
}

export async function logAdminAction(
  action: AdminActionType,
  details: string,
  target?: { id?: string; name?: string; type?: AdminAuditLog["targetType"] },
  adminEmail: string = "superadmin@promoh.com"
) {
  try {
    await addDoc(collection(db, "admin_audit_logs"), {
      action,
      details,
      targetId: target?.id || "",
      targetName: target?.name || "",
      targetType: target?.type || "",
      adminEmail,
      timestamp: serverTimestamp(),
      createdAtIso: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Failed to write admin audit log:", err);
  }
}
