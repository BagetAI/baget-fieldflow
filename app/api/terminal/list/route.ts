import { NextResponse } from 'next/server';
import { dispatchSurplusNotifications } from '@/lib/notifications';

/**
 * FieldFlow Kitchen Anchor Terminal API
 * Endpoint: /api/terminal/list
 * Purpose: Allows ruggedized kitchen terminals to post surplus inventory in real-time.
 * 
 * Logic:
 * - Accepts produce details from the terminal.
 * - Calculates a strict 4-hour expiration window.
 * - Generates the FSMA 204 compliant harvest timestamp.
 * - Synchronizes with the FieldFlow_Listings marketplace database.
 * - NEW: Triggers real-time SMS alerts to nearby restaurants (20mi radius).
 */

const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';

export async function POST(req: Request) {
  try {
    // 1. Parse payload from Terminal
    const body = await req.json();
    const { produce_type, quantity, price, farm_id } = body;

    // Validation
    if (!produce_type || !quantity || !price || !farm_id) {
      return NextResponse.json({ 
        error: 'Missing required fields: produce_type, quantity, price, and farm_id are mandatory.' 
      }, { status: 400 });
    }

    // 2. Calculate Timestamps
    const now = new Date();
    const harvest_date = now.toISOString();
    
    // 4-Hour Expiration Window (240 minutes)
    const expiresAtDate = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const expires_at = expiresAtDate.toISOString();

    // 3. Prepare Database Row
    const newListing = {
      produce_type,
      quantity: Number(quantity),
      price,
      harvest_date,
      expires_at,
      farm_id,
      status: 'Available'
    };

    /**
     * Database Synchronization
     */
    const dbResponse = await fetch(`https://baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [{
          externalKey: `TERM-${produce_type.toUpperCase().replace(/\s+/g, '-')}-${Date.now()}`,
          data: newListing
        }]
      })
    });

    if (!dbResponse.ok) {
      const errorData = await dbResponse.json();
      throw new Error(errorData.message || 'Failed to sync with marketplace database');
    }

    // 4. TRIGGER NOTIFICATION ENGINE
    // We dispatch notifications asynchronously to prevent blocking the terminal response
    const notificationResult = await dispatchSurplusNotifications(newListing);

    // 5. Return success to Terminal
    return NextResponse.json({
      success: true,
      message: 'Surplus listing successfully published to marketplace and broadcast to local kitchens.',
      listing: newListing,
      fsma_lot_code: `FF-${now.toISOString().split('T')[0].replace(/-/g, '')}-${farm_id.substring(0, 4)}`,
      notifications: notificationResult
    });

  } catch (error: any) {
    console.error('Terminal Sync Error:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error.message 
    }, { status: 500 });
  }
}
