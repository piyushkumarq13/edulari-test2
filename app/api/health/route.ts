import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";

/**
 * Health check endpoint for Stage 1 debugging infrastructure.
 * Returns ok status with minimal database connectivity test.
 * Never exposes connection details or secrets in response.
 */
export async function GET() {
  try {
    // Run a trivial query to verify DB connectivity
    await sql`SELECT 1 as healthy`;
    
    return NextResponse.json({ 
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "edulari-api"
    });
  } catch (err) {
    // Log full error for debugging, but only expose generic message
    console.error("[health] database connection failed:", err);
    return NextResponse.json({ 
      status: "error",
      message: "Database connectivity check failed",
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}
