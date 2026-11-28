import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // Allow up to 5 password attempts per 15 minutes per IP to block brute-forcing
    const limit = rateLimit(`admin-verify-${ip}`, 5, 15 * 60 * 1000);

    if (!limit.success) {
      const waitMinutes = Math.ceil((limit.reset - Date.now()) / (60 * 1000));
      return NextResponse.json(
        {
          error: `Too many failed attempts. Security cooldown active. Please try again in ${waitMinutes} minute(s).`,
        },
        { status: 429 }
      );
    }

    const { password } = await req.json();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      console.error("ADMIN_PASSWORD env variable is not set.");
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    if (password === adminPassword) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json(
      {
        error: `Incorrect password. ${limit.remaining} attempt(s) remaining before temporary lockout.`,
      },
      { status: 401 }
    );
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
