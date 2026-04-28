import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_51P4m6fL2Xv6f...dummy', {
  apiVersion: '2024-04-10' as any,
});

const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';

export async function POST(req: Request) {
  try {
    const { produce_type, price, quantity, listingId } = await req.json();

    // 1. Create Stripe Checkout Session
    // We parse the price string (e.g., "$4.50") to cents
    const unitAmount = Math.round(parseFloat(price.replace('$', '')) * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${produce_type} Surplus Rescue`,
              description: `${quantity} lbs of fresh ${produce_type}`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1, // Treating the lot as a single item for checkout
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://baget-fieldflow.vercel.app'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://baget-fieldflow.vercel.app'}/index.html`,
      metadata: {
        listingId: listingId,
        produce_type: produce_type,
      },
    });

    // 2. Update database status to 'Reserved'
    // In a real scenario, we'd use the listingId to update. 
    // Since we are using an agent database, we'll upsert with the externalKey if we had one,
    // or just assume the frontend provides a unique identifier.
    // For now, we signal intent to the webhook via metadata.
    
    // We'll update the row to 'Reserved' immediately to block other buyers
    await fetch(`https://app.baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [{
          externalKey: listingId, // Using the listing's unique key
          data: {
            status: 'Reserved'
          }
        }]
      })
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
