import { NextResponse } from 'next/server';
import { z } from 'zod';
import { dispatchSurplusNotifications } from '@/lib/notifications';
import { processUniqueHarvestItems, generateFsmaLotCode } from '@/lib/inventory';

/**
 * FieldFlow Farm Inventory Webhook
 * Endpoint: POST /api/inventory/webhook
 * 
 * Purpose: Receives harvest gluts from anchor farms, processes them 
 * into unique inventory items, and triggers the marketplace engine.
 */

const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';
const FIELD_FLOW_SHARED_SECRET = process.env.FIELD_FLOW_WEBHOOK_SECRET || 'FF_SHARED_SECRET_2026';

// 1. Zod Validation Schema
const InventoryItemSchema = z.object({
  produce_type: z.string().min(1),
  quantity_lbs: z.number().positive(),
  unit_price: z.number().positive(),
  status: z.enum(['In-Field', 'Packed', 'Ready'])
});

const HarvestEventSchema = z.object({
  timestamp: z.string().datetime(),
  items: z.array(InventoryItemSchema).min(1)
});

const WebhookPayloadSchema = z.object({
  farm_id: z.string().min(1),
  secret_key: z.string().min(1),
  harvest_event: HarvestEventSchema
});

export async function POST(req: Request) {
  try {
    // 2. Authentication
    const secretHeader = req.headers.get('x-fieldflow-secret');
    if (secretHeader !== FIELD_FLOW_SHARED_SECRET && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Request Parsing
    const body = await req.json();
    const validation = WebhookPayloadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid Payload', 
        details: validation.error.format() 
      }, { status: 400 });
    }

    const { farm_id, harvest_event } = validation.data;

    // 4. PROCESS UNIQUE ITEMS
    // Deduplicate and merge items by produce_type
    const uniqueItems = processUniqueHarvestItems(harvest_event.items);
    const now = new Date();
    const results = [];

    // 5. Batch Process into Marketplace
    for (const item of uniqueItems) {
      // 4-Hour Expiration Window
      const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
      
      const lotCode = generateFsmaLotCode(farm_id, harvest_event.timestamp);

      const newListing = {
        produce_type: item.produce_type,
        quantity: item.quantity_lbs,
        price: `$${item.unit_price.toFixed(2)}`,
        harvest_date: harvest_event.timestamp,
        expires_at: expiresAt,
        farm_id: farm_id,
        fsma_lot_code: lotCode,
        status: 'Available'
      };

      // Idempotency check: preventing duplicates for this harvest event
      const externalKey = `WEBHOOK-2026-${farm_id}-${item.produce_type.toUpperCase().replace(/\s+/g, '-')}-${harvest_event.timestamp.slice(0, 13)}`;

      // Sync with Agent Database
      const dbResponse = await fetch(`https://app.baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: [{
            externalKey,
            data: newListing
          }]
        })
      });

      if (dbResponse.ok) {
        // Trigger SMS alerts for kitchens within 20 miles
        await dispatchSurplusNotifications(newListing);
        
        results.push({
          produce: item.produce_type,
          quantity: item.quantity_lbs,
          lot_code: lotCode,
          status: 'LIVE_NOW'
        });
      } else {
        results.push({
          produce: item.produce_type,
          status: 'ERROR',
          message: 'Database sync failed'
        });
      }
    }

    // 6. Return Polished JSON with Unique Items
    return NextResponse.json({
      success: true,
      farm_id: farm_id,
      processing_timestamp: now.toISOString(),
      unique_items_processed: uniqueItems.length,
      harvest_summary: results,
      compliance: "FSMA 204 Active"
    });

  } catch (error: any) {
    console.error('Inventory Webhook Error:', error);
    return NextResponse.json({ 
      error: 'Processing Failed', 
      details: error.message 
    }, { status: 500 });
  }
}

/**
 * Basic GET endpoint for documentation/health check
 */
export async function GET() {
  return NextResponse.json({
    status: "Active",
    endpoint: "/api/inventory/webhook",
    auth: "x-fieldflow-secret",
    version: "2026.04.26"
  });
}
