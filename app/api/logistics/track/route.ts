import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * FieldFlow Real-Time Logistics Tracking API
 * Endpoint: POST /api/logistics/track
 * 
 * Purpose: Handles real-time status webhooks from 3PL partners (DoorDash Drive, GoShare).
 * Synchronizes delivery state with the marketplace and kitchen terminals.
 */

const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';
const TERMINALS_DB_ID = '9c8cf374-debd-4b63-a3b6-2e5c22dcbf42';

// 1. Webhook Validation Schema
const CourierWebhookSchema = z.object({
  listingId: z.string().min(1, "Listing externalKey is required"),
  status: z.enum(['COURIER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVING_SOON', 'DELIVERED', 'CANCELLED']),
  courier_name: z.string().optional(),
  estimated_arrival: z.string().datetime().optional(),
  tracking_url: z.string().url().optional(),
  lat: z.number().optional(),
  lng: z.number().optional()
});

export async function POST(req: Request) {
  try {
    // 2. Authentication Check
    const apiKey = req.headers.get('x-courier-api-key');
    if (apiKey !== process.env.COURIER_API_KEY && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Payload Parsing
    const body = await req.json();
    const validation = CourierWebhookSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid Payload', 
        details: validation.error.format() 
      }, { status: 400 });
    }

    const { listingId, status, courier_name, estimated_arrival, tracking_url } = validation.data;
    const now = new Date().toISOString();

    // 4. Update Marketplace Listing State
    // We map internal courier statuses to marketplace display statuses
    const marketplaceStatusMap: Record<string, string> = {
      'COURIER_ASSIGNED': 'Courier Assigned',
      'PICKED_UP': 'In Transit',
      'IN_TRANSIT': 'In Transit',
      'ARRIVING_SOON': 'Arriving Soon',
      'DELIVERED': 'Delivered',
      'CANCELLED': 'Logistics Error'
    };

    const updateListingRes = await fetch(`https://app.baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [{
          externalKey: listingId,
          data: {
            status: marketplaceStatusMap[status],
            last_logistics_update: now,
            courier_tracking_url: tracking_url || '',
            eta: estimated_arrival || ''
          }
        }]
      })
    });

    if (!updateListingRes.ok) {
      throw new Error(`Failed to update listing: ${listingId}`);
    }

    // 5. Trigger "Server Action" simulation: Update Kitchen Terminal Status
    // We fetch the listing first to find which site it belongs to
    const fetchListingRes = await fetch(`https://app.baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`);
    const listings = await fetchListingRes.json();
    const listing = listings.find((l: any) => l.externalKey === listingId);

    if (listing && listing.destination_site) {
      // Find the terminal for this site and pulse the status
      await fetch(`https://app.baget.ai/api/public/databases/${TERMINALS_DB_ID}/rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: [{
            externalKey: listing.destination_site, // Assuming terminal ID or site name is the key
            data: {
              status: status === 'ARRIVING_SOON' ? 'URGENT_ARRIVAL' : 'Online',
              last_heartbeat: now,
              logistics_feed: `Courier ${courier_name || 'Assigned'} is ${status.toLowerCase().replace('_', ' ')}`
            }
          }]
        })
      });
    }

    // 6. Return Operational Success
    return NextResponse.json({
      success: true,
      timestamp: now,
      tracking_event: {
        listing_id: listingId,
        new_status: marketplaceStatusMap[status],
        eta: estimated_arrival || 'N/A'
      }
    });

  } catch (error: any) {
    console.error('Logistics Tracking Error:', error);
    return NextResponse.json({ 
      error: 'Logistics Sync Failed', 
      details: error.message 
    }, { status: 500 });
  }
}
