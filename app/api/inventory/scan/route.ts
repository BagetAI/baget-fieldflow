import { NextResponse } from 'next/server';
import { z } from 'zod';
import { dispatchSurplusNotifications } from '@/lib/notifications';
import { generateFsmaLotCode } from '@/lib/inventory';

/**
 * FieldFlow Farm Inventory Scan API
 * Endpoint: POST /api/inventory/scan
 * 
 * Purpose: Allows farms to quickly scan a barcode and update surplus inventory.
 * Automatically maps barcodes to produce types and generates compliance data.
 */

const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';

// Mock Barcode to Produce Mapping
const BARCODE_MAP: Record<string, { produce_type: string, unit_price: number }> = {
  '78901234': { produce_type: 'Wild Ramps', unit_price: 14.25 },
  '89012345': { produce_type: 'Heirloom Tomatoes', unit_price: 2.45 },
  '90123456': { produce_type: 'Spring Green Garlic', unit_price: 4.50 },
  '01234567': { produce_type: 'Baby Spinach', unit_price: 3.90 },
  '12345678': { produce_type: 'Organic Asparagus', unit_price: 3.60 },
  '23456789': { produce_type: 'Bok Choy', unit_price: 1.85 }
};

const ScanSchema = z.object({
  barcode: z.string().min(1, "Barcode is required"),
  quantity: z.number().positive("Quantity must be positive"),
  farm_id: z.string().min(1, "Farm ID is required")
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = ScanSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid Request', 
        details: validation.error.format() 
      }, { status: 400 });
    }

    const { barcode, quantity, farm_id } = validation.data;

    // 1. Map Barcode to Produce
    const produceInfo = BARCODE_MAP[barcode];
    if (!produceInfo) {
      return NextResponse.json({ 
        error: 'Unknown Barcode', 
        message: `Barcode ${barcode} not recognized in FieldFlow system.` 
      }, { status: 404 });
    }

    const { produce_type, unit_price } = produceInfo;
    const now = new Date();
    const harvestTimestamp = now.toISOString();

    // 2. Generate Compliance Data
    const lotCode = generateFsmaLotCode(farm_id, harvestTimestamp);
    const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();

    const listingData = {
      produce_type,
      quantity: quantity.toString(),
      price: `$${unit_price.toFixed(2)}/lb`,
      harvest_date: harvestTimestamp,
      expires_at: expiresAt,
      farm_id,
      fsma_lot_code: lotCode,
      status: 'Available'
    };

    // 3. Persist to Marketplace
    const externalKey = `SCAN-2026-${farm_id}-${barcode}-${Date.now()}`;
    
    const dbResponse = await fetch(`https://baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`, {
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
      throw new Error(`Database sync failed: ${await dbResponse.text()}`);
    }

    // 4. Trigger Notifications
    await dispatchSurplusNotifications({
      produce_type,
      quantity,
      price: `$${unit_price.toFixed(2)}`,
      farm_id
    });

    return NextResponse.json({
      success: true,
      message: 'Scan processed. Surplus listing active.',
      listing: {
        id: externalKey,
        produce_type,
        quantity,
        lot_code: lotCode,
        status: 'LIVE_NOW'
      },
      compliance: "FSMA 204 Active",
      timestamp: harvestTimestamp
    });

  } catch (error: any) {
    console.error('Inventory Scan API Error:', error);
    return NextResponse.json({ 
      error: 'Scan Processing Failed', 
      details: error.message 
    }, { status: 500 });
  }
}

/**
 * Documentation Endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/inventory/scan",
    method: "POST",
    payload: {
      barcode: "String (e.g. '78901234')",
      quantity: "Number (e.g. 20)",
      farm_id: "String (e.g. 'FARM-SNO-01')"
    },
    mappings: BARCODE_MAP,
    year: 2026
  });
}
