import { NextResponse } from 'next/server';
import { dispatchSurplusNotifications } from '@/lib/notifications';

/**
 * FieldFlow Core Product Logic: Terminal Inventory Sync Handler
 * Endpoint: POST /api/v1/terminal/sync
 * 
 * Purpose: Securely handles heartbeat signals and inventory state 
 * synchronization from FF-SEA hardware units.
 */

const TERMINALS_DB_ID = '9c8cf374-debd-4b63-a3b6-2e5c22dcbf42';
const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      terminal_id, 
      site_name, 
      battery_level, 
      connectivity_type, 
      inventory_updates 
    } = body;

    // 1. Basic Validation
    if (!terminal_id) {
      return NextResponse.json({ error: 'Missing terminal_id' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 2. Handle Heartbeat (Update Terminal Status)
    await fetch(`https://app.baget.ai/api/public/databases/${TERMINALS_DB_ID}/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [{
          externalKey: terminal_id,
          data: {
            terminal_id,
            site_name: site_name || 'Active Pilot Site',
            last_heartbeat: now,
            status: 'Online',
            battery_level: battery_level || 100,
            connectivity_type: connectivity_type || 'Wi-Fi 6'
          }
        }]
      })
    });

    // 3. Handle Inventory Updates (Sync Listings)
    const listingsProcessed: any[] = [];
    if (inventory_updates && Array.isArray(inventory_updates)) {
      for (const item of inventory_updates) {
        const { produce_type, quantity, price, farm_id } = item;
        
        const expiresAtDate = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4-hour window
        
        const newListing = {
          produce_type,
          quantity: Number(quantity),
          price,
          harvest_date: now,
          expires_at: expiresAtDate.toISOString(),
          farm_id: farm_id || terminal_id,
          status: 'Available'
        };

        const externalKey = `SYNC-${terminal_id}-${produce_type.toUpperCase().replace(/\s+/g, '-')}-${Date.now()}`;

        // Update listings database
        await fetch(`https://app.baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: [{
              externalKey,
              data: newListing
            }]
          })
        });

        // Trigger Notification Engine (Batch 8)
        await dispatchSurplusNotifications(newListing);
        
        listingsProcessed.push({
          produce_type,
          fsma_lot_code: `FF-${now.split('T')[0].replace(/-/g, '')}-${terminal_id.substring(0, 4)}`
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now,
      terminal_status: 'Synchronized',
      listings_count: listingsProcessed.length,
      processed_items: listingsProcessed
    });

  } catch (error: any) {
    console.error('Terminal Sync Handler Error:', error);
    return NextResponse.json({ 
      error: 'Sync Failed', 
      details: error.message 
    }, { status: 500 });
  }
}
