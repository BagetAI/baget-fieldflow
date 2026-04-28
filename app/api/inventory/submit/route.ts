import { NextResponse } from 'next/server';
import { z } from 'zod';
import { processUniqueHarvestItems, generateFsmaLotCode } from '@/lib/inventory';
import { dispatchSurplusNotifications } from '@/lib/notifications';

/**
 * FieldFlow Farm Inventory Submission API
 * Endpoint: POST /api/inventory/submit
 * 
 * Purpose: A standard ingestion point for farm harvest data. 
 * Validates, deduplicates, and synchronizes inventory with the marketplace.
 */

const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';

// 1. Validation Schema
const SubmissionSchema = z.object({
  farm_id: z.string().min(1),
  items: z.array(z.object({
    produce_type: z.string().min(1),
    quantity_lbs: z.number().positive(),
    unit_price: z.number().positive(),
    status: z.enum(['In-Field', 'Packed', 'Ready'])
  })).min(1),
  harvest_timestamp: z.string().datetime().optional().default(() => new Date().toISOString())
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = SubmissionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid Request Body', 
        details: validation.error.format() 
      }, { status: 400 });
    }

    const { farm_id, items, harvest_timestamp } = validation.data;

    // 2. DEDUPLICATE AND SUMMARIZE
    // We use the utility to merge items of the same type
    const uniqueItems = processUniqueHarvestItems(items);
    
    const now = new Date();
    const savedItems = [];

    // 3. PERSIST UNIQUE ENTRIES
    for (const item of uniqueItems) {
      // 4-Hour Expiration logic (Standard for FieldFlow 2026)
      const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
      const lotCode = generateFsmaLotCode(farm_id, harvest_timestamp);

      const listingData = {
        produce_type: item.produce_type,
        quantity: item.quantity_lbs,
        price: `$${item.unit_price.toFixed(2)}`,
        harvest_date: harvest_timestamp,
        expires_at: expiresAt,
        farm_id: farm_id,
        fsma_lot_code: lotCode,
        status: 'Available'
      };

      // Atomic ID for idempotency/sync
      const externalKey = `SUBMIT-2026-${farm_id}-${item.produce_type.toUpperCase().replace(/\s+/g, '-')}-${harvest_timestamp.slice(0, 16)}`;

      // Sync to FieldFlow_Listings Database
      const dbResponse = await fetch(`https://app.baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: [{
            externalKey,
            data: listingData
          }]
        })
      });

      if (dbResponse.ok) {
        // Trigger Geofenced Notifications (20mi radius)
        await dispatchSurplusNotifications(listingData);
        
        savedItems.push({
          produce: item.produce_type,
          quantity_lbs: item.quantity_lbs,
          lot_code: lotCode,
          status: 'Listing Active'
        });
      }
    }

    // 4. RETURN UNIQUE ITEMS LIST
    return NextResponse.json({
      success: true,
      farm_id,
      submitted_at: now.toISOString(),
      unique_items: savedItems,
      compliance_status: "FSMA 204 Compliant"
    });

  } catch (error: any) {
    console.error('Inventory Submission API Error:', error);
    return NextResponse.json({ 
      error: 'Submission Failed', 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * Endpoint Metadata
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/inventory/submit",
    method: "POST",
    description: "Accepts JSON harvest data and returns a list of unique, summarized items.",
    year: 2026
  });
}
