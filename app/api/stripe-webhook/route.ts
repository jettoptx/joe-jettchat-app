import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * POST /api/stripe-webhook
 *
 * Handles Stripe payment completion webhooks for JettChat Access purchases.
 * In production, verify signature with STRIPE_WEBHOOK_SECRET.
 *
 * For now: Stripe payment link redirects to /callback?stripe=success
 * which triggers client-side /api/jtx-gate POST with method: "stripe".
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // TODO: Verify Stripe webhook signature
    // const sig = request.headers.get("stripe-signature");
    // const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);

    const event = JSON.parse(body);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const email = session.customer_email;

      console.log("[stripe-webhook] JettChat Access purchased:", {
        email,
        amount: session.amount_total,
        sessionId: session.id,
      });

      // In production: create/update user record in Convex with stripe access
      // For now: client handles gate cookie via redirect flow
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe-webhook] Error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 400 });
  }
}
