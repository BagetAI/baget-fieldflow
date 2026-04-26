import { NextResponse } from 'next/server';
import { z } from 'zod';
import { dispatchSurplusNotifications } from '@/lib/notifications';

/**
 * FieldFlow Farm Inventory Webhook
 * Endpoint: POST /api/inventory/webhook
 * Purpose: Allows farms to push inventory updates directly from their systems.
 * 
 * Logic:
 * - Validates farmId and array of items.
 * - For each item, calculates a 4-hour expiration window.
 * - Automatically generates FSMA 204 lot codes.
 * - Publishes to the FieldFlow_Listings marketplace database.
 * - Triggers real-time notifications for nearby restaurants.
 */

const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';

// 1. Define the input contract schema
const InventoryItemSchema = z.object({
  produce: z.string().min(1, "Produce type is required"),
  quantityKg: z.number().positive("Quantity must be positive"),
  pricePerKg: z.number().positive("Price must be positive"),
  harvestDate: z.string().datetime({ message: "Harvest date must be a valid ISO-8601 string" })
});

const WebhookPayloadSchema = z.object({
  farmId: z.string().min(1, "Farm ID is required"),
  items: z.array(InventoryItemSchema).min(1, "At least one item is required")
});

export async function POST(req: Request) {
  try {
    // 2. Request Parsing & Validation
    const body = await req.json();
    const validation = WebhookPayloadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Contract Violation', 
        details: validation.error.format() 
      }, { status: 400 });
    }

    const { farmId, items } = validation.data;
    const now = new Date();
    const results = [];

    // 3. Process each item (Sync with Marketplace)
    for (const item of items) {
      const expiresAtDate = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4-hour shelf life
      
      const newListing = {
        produce_type: item.produce,
        quantity: item.quantityKg,
        price: `$${item.pricePerKg.toFixed(2)}`,
        harvest_date: item.harvestDate,
        expires_at: expiresAtDate.toISOString(),
        farm_id: farmId,
        status: 'Available'
      };

      // Generate a unique key for the listing
      const externalKey = `WEBHOOK-${farmId}-${item.produce.toUpperCase().replace(/\s+/g, '-')}-${Date.now()}`;

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
        // Trigger notification engine for each successfully listed item
        await dispatchSurplusNotifications(newListing);
        
        results.push({
          produce: item.produce,
          status: 'Published',
          lot_code: `FF-${now.toISOString().split('T')[0].replace(/-/g, '')}-${farmId.substring(0, 4)}`
        });
      } else {
        results.push({
          produce: item.produce,
          status: 'Failed',
          error: 'Database sync error'
        });
      }
    }

    // 4. Return summary to the farm system
    return NextResponse.json({
      success: true,
      farm_id: farmId,
      timestamp: now.toISOString(),
      items_processed: results.length,
      details: results
    });

  } catch (error: any) {
    console.error('Inventory Webhook Error:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error.message 
    }, { status: 500 });
  }
}
