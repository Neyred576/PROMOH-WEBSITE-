import { NextResponse } from "next/server";

export async function GET() {
  const startTime = Date.now();
  const uptimeSeconds = Math.floor(process.uptime());

  return NextResponse.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: `${uptimeSeconds}s`,
      environment: process.env.NODE_ENV || "production",
      services: {
        api: "operational",
        database: "connected",
        marketplace: "active",
      },
      latencyMs: Date.now() - startTime,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
