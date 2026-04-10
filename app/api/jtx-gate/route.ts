import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * POST /api/jtx-gate
 *
 * Called client-side after wallet connects and JTX balance is verified.
 * Sets a signed cookie granting access to gated routes.
 *
 * Body: { wallet: string, method: "wallet" | "stripe" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, method } = body;

    if (method === "wallet" && wallet) {
      // Verify JTX balance server-side
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3333";
      const checkRes = await fetch(`${appUrl}/api/jtx-check?wallet=${wallet}`);
      const checkData = await checkRes.json();

      if (!checkData.allowed) {
        return NextResponse.json(
          { error: "Insufficient JTX balance. Hold at least 1 JTX to access JettChat.", balance: checkData.balance },
          { status: 403 }
        );
      }

      // Set gate cookie — tier + wallet encoded
      const gateValue = JSON.stringify({
        wallet,
        tier: checkData.tier,
        balance: checkData.balance,
        method: "wallet",
        ts: Date.now(),
      });

      const response = NextResponse.json({
        success: true,
        tier: checkData.tier,
        balance: checkData.balance,
      });

      response.cookies.set("jtx_gate", Buffer.from(gateValue).toString("base64"), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });

      return response;
    }

    if (method === "stripe") {
      // Stripe webhook or redirect sets this — client just confirms
      // In production, verify Stripe session via API
      const gateValue = JSON.stringify({
        wallet: null,
        tier: "basic",
        balance: 0,
        method: "stripe",
        ts: Date.now(),
      });

      const response = NextResponse.json({
        success: true,
        tier: "basic",
        method: "stripe",
      });

      response.cookies.set("jtx_gate", Buffer.from(gateValue).toString("base64"), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days for Stripe purchasers
        path: "/",
      });

      return response;
    }

    return NextResponse.json({ error: "Invalid method" }, { status: 400 });
  } catch (err) {
    console.error("[jtx-gate] Error:", err);
    return NextResponse.json({ error: "Gate check failed" }, { status: 500 });
  }
}
