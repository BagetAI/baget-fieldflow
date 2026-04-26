import { NextResponse } from 'next/server';
import { runMatchingEngine } from '@/lib/matching-engine';

/**
 * FieldFlow Surplus Match and Notify Engine
 * Endpoint: POST /api/engine/match
 * 
 * Purpose: cross-references farm surplus listings with restaurant 'wishlists'
 * based on the Atlanta Logistics Hub geographic parameters.
 */

export async function POST(req: Request) {
  try {
    const result = await runMatchingEngine();

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      engine_status: 'Cycle Complete',
      ...result,
      notification_payload: result.matches.map(m => ({
        target_site: m.restaurant_id,
        alert_type: 'SURPLUS_MATCH',
        priority: m.match_reason.includes('High') ? 'URGENT' : 'STANDARD',
        message: `MATCH DETECTED: ${m.match_reason} available within ${m.distance_miles} miles.`
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// Support GET for testing convenience in browser
export async function GET() {
  return POST({} as Request);
}
