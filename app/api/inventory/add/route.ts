import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * FieldFlow Farm Inventory Add API
 * Endpoint: POST /api/inventory/add
 * 
 * Purpose: Simple, single-item ingestion for farm inventory.
 * Ideal for lightweight integrations or IoT sensors at the farm gate.
 */

const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';

// Validation Schema for a single produce listing
const InventoryAddSchema = z.object({
  produce_type: z.string().min(1, "Produce name is required"),
  quantity: z.number().positive("Quantity must be positive"),
  price: z.string().min(1, "Price is required (e.g. '$4.50/lb')"),
  farm_name: z.string().min(1, "Farm name is required for traceability")
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = InventoryAddSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Validation Failed', 
        details: validation.error.format() 
      }, { status: 400 });
    }

    const { produce_type, quantity, price, farm_name } = validation.data;
    const now = new Date();
    const harvestDate = now.toISOString();

    // Generate FSMA 204 compliant Lot Code for 2026
    const lotCode = `FF-2026${now.getMonth() + 1}${now.getDate()}-${farm_name.substring(0, 3).toUpperCase()}`;

    // We pack the farm info and lot code into the produce_type/status 
    // to work around the limited columns in the legacy FieldFlow_Listings DB
    const listingData = {
      produce_type: `${produce_type} [${farm_name}]`,
      quantity: quantity.toString(),
      price: price,
      harvest_date: harvestDate,
      status: `Available | LOT: ${lotCode}`
    };

    // Atomic Key for deduplication
    const externalKey = `ADD-2026-${farm_name.toUpperCase().replace(/\s+/g, '-')}-${produce_type.toUpperCase().replace(/\s+/g, '-')}-${now.getTime()}`;

    // POST to Agent Database
    const response = await fetch(`https://baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [{
          externalKey,
          data: listingData
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Database Sync Failed: ${errorText}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Produce successfully listed in FieldFlow Marketplace.',
      listing: {
        id: externalKey,
        ...listingData,
        fsma_lot_code: lotCode
      },
      year: 2026
    });

  } catch (error: any) {
    console.error('Inventory Add API Error:', error);
    return NextResponse.json({ 
      error: 'Submission Failed', 
      details: error.message 
    }, { status: 500 });
  }
}

/**
 * Documentation GET endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/inventory/add",
    method: "POST",
    payload: {
      produce_type: "String (e.g. 'Wild Ramps')",
      quantity: "Number (e.g. 40)",
      price: "String (e.g. '$14.25/lb')",
      farm_name: "String (e.g. 'Local Roots Farm')"
    },
    compliance: "FSMA 204 / 2026 Standard"
  });
}
