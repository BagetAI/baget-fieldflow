import { NextResponse } from 'next/server';
import { z } from 'zod';
import { dispatchSurplusNotifications } from '@/lib/notifications';

/**
 * FieldFlow Farm Inventory Webhook (Batch 12 Refinement)
 * Endpoint: POST /api/inventory/webhook
 * 
 * Logic:
 * - Implements Batch 12 security (Shared Secret header).
 * - Validates Batch 12 JSON contract (farm_id, secret_key, harvest_event).
 * - Processes items into the marketplace database.
 * - Triggers geographic notification engine for local kitchens.
 */

const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';
const FIELD_FLOW_SHARED_SECRET = process.env.FIELD_FLOW_WEBHOOK_SECRET || 'FF_SHARED_SECRET_2026';

// 1. Batch 12 Data Contract Schema
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
  secret_key: z.string().min(1), // Secondary validation field
  harvest_event: HarvestEventSchema
});

export async function POST(req: Request) {
  try {
    // 2. Authentication: Shared Secret Header
    const secretHeader = req.headers.get('x-fieldflow-secret');
    if (secretHeader !== FIELD_FLOW_SHARED_SECRET && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized: Invalid Shared Secret' }, { status: 401 });
    }

    // 3. Request Parsing & Schema Validation
    const body = await req.json();
    const validation = WebhookPayloadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Contract Violation', 
        details: validation.error.format() 
      }, { status: 400 });
    }

    const { farm_id, harvest_event } = validation.data;
    const now = new Date();
    const results = [];

    // 4. Batch Process Items (Sync with Marketplace)
    for (const item of harvest_event.items) {
      // Automatic 4-hour expiration window as per architected freshness moat
      const expiresAtDate = new Date(now.getTime() + 4 * 60 * 60 * 1000); 
      
      const newListing = {
        produce_type: item.produce_type,
        quantity: item.quantity_lbs,
        price: `$${item.unit_price.toFixed(2)}`,
        harvest_date: harvest_event.timestamp,
        expires_at: expiresAtDate.toISOString(),
        farm_id: farm_id,
        status: 'Available'
      };

      // Idempotency: Unique key prevents duplicate listings from same harvest event
      const externalKey = `WEBHOOK-B12-${farm_id}-${item.produce_type.toUpperCase().replace(/\s+/g, '-')}-${harvest_event.timestamp}`;

      // POST to agent database
      const dbResponse = await fetch(`https://baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`, {
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
        // Trigger notification engine for nearby kitchens (20-mile radius)
        await dispatchSurplusNotifications(newListing);
        
        // Generate FSMA 204 Traceability Lot Code
        const lotCode = `FF-${now.toISOString().split('T')[0].replace(/-/g, '')}-${farm_id.substring(0, 4).toUpperCase()}`;
        
        results.push({
          produce: item.produce_type,
          status: 'LIVE_NOW',
          fsma_204_lot_code: lotCode,
          message: 'Listing published and geofenced notifications dispatched.'
        });
      } else {
        results.push({
          produce: item.produce_type,
          status: 'FAILED',
          error: 'Marketplace Sync Error'
        });
      }
    }

    // 5. Response Summary
    return NextResponse.json({
      success: true,
      farm_id: farm_id,
      timestamp: now.toISOString(),
      summary: {
        total_items: harvest_event.items.length,
        processed: results.filter(r => r.status === 'LIVE_NOW').length
      },
      details: results
    });

  } catch (error: any) {
    console.error('Inventory Webhook Exception:', error);
    return NextResponse.json({ 
      error: 'Internal Operational Error', 
      details: error.message 
    }, { status: 500 });
  }
}
