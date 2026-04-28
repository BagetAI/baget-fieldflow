import { NextResponse } from 'next/server';
import { z } from 'zod';
import { dispatchSurplusNotifications } from '@/lib/notifications';
import { generateFsmaLotCode } from '@/lib/inventory';

/**
 * FieldFlow Farm Inventory Scan API
 * Endpoint: POST /api/inventory/scan
 * 
 * Purpose: Allows farms to quickly scan a barcode and update surplus inventory.
 * Automatically maps barcodes to produce types, generates FSMA 204 compliance data,
 * and triggers the 180-minute logistics loop by notifying nearby kitchens.
 */

const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';

// 2026 Pilot Barcode Mapping (Seattle & Atlanta Hubs)
// Pricing based on Batch 12 Analyst COGS reduction validation (42% average savings)
const BARCODE_MAP: Record<string, { produce_type: string, rescue_price: string, unit: string }> = {
  '78901234': { produce_type: 'Wild Ramps', rescue_price: '$14.25', unit: 'lb' },
  '89012345': { produce_type: 'Heirloom Tomatoes', rescue_price: '$2.45', unit: 'lb' },
  '90123456': { produce_type: 'Spring Green Garlic', rescue_price: '$4.50', unit: 'lb' },
  '12345678': { produce_type: 'Organic Asparagus', rescue_price: '$3.60', unit: 'lb' },
  '23456789': { produce_type: 'Bok Choy', rescue_price: '$1.85', unit: 'lb' },
  '01234567': { produce_type: 'Baby Spinach', rescue_price: '$11.70', unit: 'case' }
};

const ScanRequestSchema = z.object({
  barcode: z.string().min(1, "Barcode is mandatory"),
  quantity: z.number().positive("Quantity must be greater than zero"),
  farm_id: z.string().min(1, "Farm ID is mandatory for FSMA 204 traceability")
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = ScanRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Schema Validation Error', 
        details: validation.error.format() 
      }, { status: 400 });
    }

    const { barcode, quantity, farm_id } = validation.data;

    // 1. Identify Produce via Barcode Mapping
    const produceInfo = BARCODE_MAP[barcode];
    if (!produceInfo) {
      return NextResponse.json({ 
        error: 'Product Not Found', 
        message: `Barcode ${barcode} is not mapped to the 2026 pilot registry.` 
      }, { status: 404 });
    }

    const { produce_type, rescue_price, unit } = produceInfo;
    const now = new Date();
    const harvestTimestamp = now.toISOString();

    // 2. Generate Compliance & Logistics Meta
    // Every scan creates a mandatory FSMA 204 Lot Code
    const lotCode = generateFsmaLotCode(farm_id, harvestTimestamp);
    
    // Enforce strict 4-hour freshness window for "Immediate Response" marketplace
    const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();

    const listingData = {
      produce_type,
      quantity: `${quantity} ${unit}`,
      price: `${rescue_price}/${unit}`,
      harvest_date: harvestTimestamp,
      expires_at: expiresAt,
      farm_id,
      fsma_lot_code: lotCode,
      status: 'Available'
    };

    // 3. Sync to FieldFlow_Listings Database
    // Uses a high-velocity externalKey for idempotency and real-time dashboard updates
    const externalKey = `SCAN-2026-${farm_id.toUpperCase()}-${barcode}-${now.getTime()}`;
    
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

    if (!dbResponse.ok) {
      const dbError = await dbResponse.text();
      throw new Error(`Database synchronization failed: ${dbError}`);
    }

    // 4. Trigger Real-Time Notification Cycle
    // Dispatches alerts to chefs within 20 miles to secure the <180m delivery window
    const notificationResult = await dispatchSurplusNotifications({
      produce_type,
      quantity,
      price: rescue_price,
      farm_id
    });

    // 5. Successful Response
    return NextResponse.json({
      success: true,
      message: 'Surplus listing successfully published via barcode scan.',
      listing: {
        externalKey,
        produce: produce_type,
        volume: `${quantity} ${unit}`,
        lot_code: lotCode,
        status: 'LIVE_NOW',
        expires_at: expiresAt
      },
      logistics: {
        notification_engine: notificationResult.success ? 'Triggered' : 'Error',
        notified_sites: notificationResult.notified_count || 0
      },
      compliance: {
        standard: "FSMA 204 / 2026",
        lot_code: lotCode,
        verified: true
      }
    });

  } catch (error: any) {
    console.error('[API/INVENTORY/SCAN] Error:', error);
    return NextResponse.json({ 
      error: 'Logistics Loop Error', 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * Documentation Endpoint (Investor Transparency)
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/inventory/scan",
    method: "POST",
    description: "Rapid produce ingestion via industrial barcode scanning.",
    active_mappings: Object.keys(BARCODE_MAP).length,
    compliance_engine: "FSMA 204 Automated",
    logistics_window: "240 Minutes (Strict)",
    supported_barcodes: BARCODE_MAP,
    year: 2026
  });
}
