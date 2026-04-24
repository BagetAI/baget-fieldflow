import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_51P4m6fL2Xv6f...dummy', {
  apiVersion: '2024-04-10' as any,
});

const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } else {
      // For development/demo purposes if secret isn't set
      event = JSON.parse(body);
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const listingId = session.metadata?.listingId;

    if (listingId) {
      console.log(`Payment confirmed for listing: ${listingId}`);

      // Update the database status to 'Sold'
      try {
        const response = await fetch(`https://baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: [{
              externalKey: listingId,
              data: {
                status: 'Sold'
              }
            }]
          })
        });

        if (!response.ok) {
          console.error('Failed to update database status to Sold');
        }
      } catch (dbError) {
        console.error('Database update error:', dbError);
      }
    }
  }

  return NextResponse.json({ received: true });
}
