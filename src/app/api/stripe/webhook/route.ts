import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || stripeSecretKey === "your_stripe_secret_key") {
    return NextResponse.json({ received: true, demo: true });
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" as any });

    const body = await req.text();
    const sig = req.headers.get("stripe-signature") || "";

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret || "");
    } catch (err: any) {
      console.error("Stripe webhook signature error:", err.message);
      return NextResponse.json({ error: `Webhook signature error: ${err.message}` }, { status: 400 });
    }

    if (!adminDb) {
      console.warn("Webhook received but Firebase Admin DB is not initialized.");
      return NextResponse.json({ received: true, warning: "Admin DB offline" });
    }

    // 1. Successful payment processing
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      const { bookingId, providerId, customerId } = pi.metadata || {};

      if (bookingId) {
        const bookingRef = adminDb.collection("bookings").doc(bookingId);
        const bookingSnap = await bookingRef.get();

        // Idempotency check: don't double-process already finalized payments
        if (bookingSnap.exists) {
          const currentData = bookingSnap.data();
          if (currentData?.paymentStatus === "paid" && currentData?.paymentIntentId === pi.id) {
            return NextResponse.json({ received: true, idempotent: true });
          }
        }

        const nowIso = new Date().toISOString();
        const formattedAmount = (pi.amount / 100).toFixed(2);

        // Update booking state atomically
        await bookingRef.set(
          {
            paymentStatus: "paid",
            status: "confirmed",
            amount: pi.amount / 100,
            currency: pi.currency?.toUpperCase() || "USD",
            paymentIntentId: pi.id,
            paidAt: nowIso,
            updatedAt: nowIso,
          },
          { merge: true }
        );

        // Notify Provider
        if (providerId) {
          await adminDb.collection("notifications").add({
            userId: providerId,
            title: "💰 Payment Received",
            message: `Payment of $${formattedAmount} received for booking #${bookingId.slice(0, 7)}. Booking is now confirmed!`,
            link: "/provider/dashboard",
            type: "booking_completed",
            read: false,
            createdAt: nowIso,
          }).catch(console.error);
        }

        // Notify Customer
        if (customerId) {
          await adminDb.collection("notifications").add({
            userId: customerId,
            title: "✅ Payment Confirmed",
            message: `Your payment of $${formattedAmount} was successful. Your service is scheduled!`,
            link: `/dashboard`,
            type: "booking_update",
            read: false,
            createdAt: nowIso,
          }).catch(console.error);
        }
      }
    }

    // 2. Failed payment processing
    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object;
      const { bookingId, customerId } = pi.metadata || {};

      if (bookingId) {
        const nowIso = new Date().toISOString();
        await adminDb.collection("bookings").doc(bookingId).set(
          {
            paymentStatus: "failed",
            updatedAt: nowIso,
          },
          { merge: true }
        );

        if (customerId) {
          await adminDb.collection("notifications").add({
            userId: customerId,
            title: "❌ Payment Failed",
            message: "Your payment attempt was declined. Please verify your card or try another payment method.",
            link: `/payment/${bookingId}`,
            type: "booking_update",
            read: false,
            createdAt: nowIso,
          }).catch(console.error);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
