import { NextResponse } from 'next/server';
import Stripe from 'stripe';

/**
 * FieldFlow Payment Success Webhook Handler
 * Endpoint: POST /api/webhook
 * 
 * Purpose: Listens for Stripe events to confirm successful produce rescues.
 * - Mark listings as 'Sold' in real-time.
 * - Log transaction data for investor reporting.
 * - Trigger fulfillment logistics.
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_51P4m6fL2Xv6f...dummy', {
  apiVersion: '2024-04-10' as any,
});

const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';
const PAYMENTS_DB_ID = 'd19d9f8e-3642-4d50-abc7-e389349e44f2';
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } else {
      // Direct JSON parsing for development/testing
      event = JSON.parse(body);
    }
  } catch (err: any) {
    console.error(`Webhook Signature Verification Failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Primary Event: Checkout Completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const listingId = session.metadata?.listingId;
    const produceType = session.metadata?.produce_type;

    if (listingId) {
      console.log(`[STRIPE] Payment Successful for Listing: ${listingId} (${produceType})`);

      try {
        // 1. Update Marketplace Inventory Status to 'Sold'
        const inventoryRes = await fetch(`https://app.baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: [{
              externalKey: listingId,
              data: {
                status: 'Sold',
                fulfillment_date: new Date().toISOString()
              }
            }]
          })
        });

        if (!inventoryRes.ok) {
          throw new Error(`Inventory Status Sync Failed: ${await inventoryRes.text()}`);
        }

        // 2. Log to FieldFlow_Payments Database for Investor Transparency
        const paymentRes = await fetch(`https://app.baget.ai/api/public/databases/${PAYMENTS_DB_ID}/rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: [{
              externalKey: `PAY-${session.id}`,
              data: {
                listing_id: listingId,
                amount_cents: session.amount_total,
                currency: session.currency || 'usd',
                chef_email: session.customer_details?.email || 'guest@example.com',
                status: 'Confirmed',
                timestamp: new Date().toISOString()
              }
            }]
          })
        });

        if (!paymentRes.ok) {
          throw new Error(`Payment Logging Failed: ${await paymentRes.text()}`);
        }

        console.log(`[SUCCESS] FieldFlow Ledger Updated: ${listingId} now marked as SOLD.`);

      } catch (err: any) {
        console.error(`[ERROR] Webhook Fulfillment Sequence Failed: ${err.message}`);
        // We return 200 anyway to Stripe to prevent excessive retries if our logic failed post-payment
      }
    }
  }

  return NextResponse.json({ 
    received: true, 
    event_type: event.type, 
    timestamp: new Date().toISOString() 
  });
}

/**
 * Health Check / Docs
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/webhook",
    status: "Operational",
    description: "Stripe Webhook Handler for 2026 Produce Transactions",
    monitored_events: ["checkout.session.completed"]
  });
}
