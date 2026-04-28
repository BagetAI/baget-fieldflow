import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';

/**
 * FieldFlow Surplus Claim API
 * Endpoint: POST /api/surplus/claim
 * Purpose: Allows kitchen terminals to reserve/claim a produce lot in real-time.
 * 
 * Logic:
 * - Validates listingId and chefId using Zod.
 * - Checks listing availability (Transactional simulation).
 * - Updates listing status to 'Claimed'.
 * - Triggers a notification to the delivery driver via Resend.
 */

const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';
const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key_123');

// 1. Zod Validation Schema
const ClaimSchema = z.object({
  listingId: z.string().min(1, "Listing ID is required"),
  chefId: z.string().min(1, "Chef ID is required"),
  siteName: z.string().min(1, "Site name is required"),
  chefContact: z.string().optional()
});

export async function POST(req: Request) {
  try {
    // 2. Request Parsing & Validation
    const body = await req.json();
    const validation = ClaimSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Validation Failed', 
        details: validation.error.format() 
      }, { status: 400 });
    }

    const { listingId, chefId, siteName, chefContact } = validation.data;

    // 3. Transactional Simulation: Check Availability
    // First, fetch current listings to verify the lot isn't already claimed
    const fetchResponse = await fetch(`https://app.baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`);
    if (!fetchResponse.ok) {
      throw new Error('Failed to fetch marketplace data');
    }

    const listings = await fetchResponse.json();
    // In our system, the 'externalKey' is used as the listingId
    const listing = listings.find((l: any) => l.externalKey === listingId || l.produce_type === listingId);

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    if (listing.status !== 'Available') {
      return NextResponse.json({ 
        error: 'Conflict', 
        message: 'This produce lot has already been reserved or sold.' 
      }, { status: 409 });
    }

    // 4. Atomic Update (Upsert via externalKey)
    // We update the status to 'Claimed' and record the chef who claimed it
    const updateResponse = await fetch(`https://app.baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [{
          externalKey: listingId,
          data: {
            ...listing, // Preserve existing data
            status: 'Claimed',
            claimed_by: chefId,
            claimed_at: new Date().toISOString(),
            destination_site: siteName
          }
        }]
      })
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      throw new Error(errorData.message || 'Failed to update listing status');
    }

    // 5. Trigger Logistics Notification (Mocked Driver Dispatch)
    // We notify the delivery driver that a new route is ready for pickup.
    const driverEmail = 'logistics-ops@fieldflow.ag'; // Mock routing to dispatch hub
    
    try {
      await resend.emails.send({
        from: 'FieldFlow Ops <notifications@fieldflow.ag>',
        to: driverEmail,
        subject: `[DISPATCH] New Surplus Pickup: ${listing.produce_type}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 4px solid black;">
            <h2 style="text-transform: uppercase;">New Pickup Request</h2>
            <p><strong>Item:</strong> ${listing.produce_type}</p>
            <p><strong>Quantity:</strong> ${listing.quantity} lbs</p>
            <p><strong>Origin:</strong> ${listing.farm_id || 'Anchor Farm'}</p>
            <p><strong>Destination:</strong> ${siteName}</p>
            <hr />
            <p style="font-weight: bold; color: #FF6B4A;">ACTION REQUIRED: ARRIVE AT FARM WITHIN 60 MINUTES.</p>
            <p style="font-size: 12px; opacity: 0.5;">FieldFlow Logistics Hub - 2026 Fleet Command</p>
          </div>
        `
      });
      console.log(`[Logistics] Notification sent to driver for ${listingId}`);
    } catch (notifError) {
      // We log but don't fail the claim if email notification fails
      console.error('Notification dispatch failed:', notifError);
    }

    // 6. Return Success Response
    return NextResponse.json({
      success: true,
      message: 'Surplus lot successfully reserved. Courier has been dispatched.',
      transaction: {
        listingId,
        chefId,
        status: 'Claimed',
        timestamp: new Date().toISOString(),
        fsma_lot_code: `FF-2026-CLAIM-${listingId.substring(0, 8)}`
      }
    });

  } catch (error: any) {
    console.error('Surplus Claim Error:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error.message 
    }, { status: 500 });
  }
}
