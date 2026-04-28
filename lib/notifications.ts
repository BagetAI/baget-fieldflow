
/**
 * FieldFlow Notification Engine
 * Purpose: Geographical radius filtering and SMS dispatch logic.
 */

const PILOT_REGISTRY_DB_ID = '427a053f-75a8-461a-8463-265ecbb1eb30';

interface Site {
  name: string;
  type: 'Farm' | 'Restaurant';
  lat: number;
  lng: number;
  contact_number: string;
}

/**
 * Calculates distance between two points using the Haversine formula (Miles)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Dispatches surplus alerts to nearby kitchens
 */
export async function dispatchSurplusNotifications(listing: { produce_type: string, quantity: number, price: string, farm_id: string }) {
  try {
    // 1. Fetch Pilot Registry
    const response = await fetch(`https://app.baget.ai/api/public/databases/${PILOT_REGISTRY_DB_ID}/rows`);
    if (!response.ok) throw new Error('Failed to fetch pilot registry');
    const registry: Site[] = await response.json();

    // 2. Identify Originating Farm
    const farm = registry.find(s => s.type === 'Farm' && (s.name.includes(listing.farm_id) || listing.farm_id.includes(s.name) || listing.farm_id.includes('SEA')));
    // Fallback: If not found, use a default Seattle coordinate for the pilot
    const farmLat = farm?.lat || 47.6479; 
    const farmLng = farm?.lng || -121.9143;

    // 3. Filter Restaurants within 20-mile radius
    const nearbyRestaurants = registry.filter(site => {
      if (site.type !== 'Restaurant') return false;
      const distance = calculateDistance(farmLat, farmLng, site.lat, site.lng);
      return distance <= 20;
    });

    console.log(`[Notification Engine] Found ${nearbyRestaurants.length} restaurants within 20 miles of ${farm?.name || listing.farm_id}`);

    // 4. Dispatch SMS (Twilio Placeholder)
    const twilioToken = process.env.TWILIO_AUTH_TOKEN || 'AC_DEBUG_MODE_TOKEN';
    
    const notificationResults = await Promise.all(nearbyRestaurants.map(async (rest) => {
      const message = `SURPLUS ALERT: ${listing.quantity}lbs of ${listing.produce_type} available at ${farm?.name || 'Local Farm'} for ${listing.price}/lb. Claim now: https://baget-fieldflow.vercel.app`;
      
      // Simulation of Twilio API Call
      console.log(`[SMS DISPATCH] To: ${rest.contact_number} | Msg: ${message}`);
      
      /**
       * REAL IMPLEMENTATION:
       * await twilioClient.messages.create({
       *   body: message,
       *   from: '+1555XXXXXXX',
       *   to: rest.contact_number
       * });
       */
      
      return { restaurant: rest.name, status: 'Sent' };
    }));

    return {
      success: true,
      notified_count: nearbyRestaurants.length,
      details: notificationResults
    };

  } catch (error: any) {
    console.error('Notification Dispatch Error:', error);
    return { success: false, error: error.message };
  }
}
