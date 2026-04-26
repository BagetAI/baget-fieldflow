
/**
 * Haversine Distance Formula (Miles)
 */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const LISTINGS_DB = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';
const WISHLISTS_DB = '403844e7-7e8a-448f-a997-c86bf2d02ee6';
const REGISTRY_DB = '427a053f-75a8-461a-8463-265ecbb1eb30';
const MATCHES_DB = 'cb9af1e3-9d69-4dd3-a784-819c681917be';

export async function runMatchingEngine() {
  try {
    // 1. Fetch all dependencies
    const [listings, wishlists, registry] = await Promise.all([
      fetch(`https://baget.ai/api/public/databases/${LISTINGS_DB}/rows`).then(r => r.json()),
      fetch(`https://baget.ai/api/public/databases/${WISHLISTS_DB}/rows`).then(r => r.json()),
      fetch(`https://baget.ai/api/public/databases/${REGISTRY_DB}/rows`).then(r => r.json())
    ]);

    const activeListings = listings.filter((l: any) => l.status === 'Available');
    const activeWishlists = wishlists.filter((w: any) => w.active === true);
    
    const matches: any[] = [];

    // 2. Iterate through listings
    for (const listing of activeListings) {
      // Find the farm in registry to get coords
      const farm = registry.find((s: any) => 
        s.type === 'Farm' && 
        (s.name === listing.farm_id || listing.farm_id?.includes(s.name))
      );

      if (!farm) continue;

      // Find wishlists that match this produce type (case insensitive)
      const matchingWishlists = activeWishlists.filter((w: any) => 
        listing.produce_type.toLowerCase().includes(w.produce_type.toLowerCase()) ||
        w.produce_type.toLowerCase().includes(listing.produce_type.toLowerCase())
      );

      for (const wishlist of matchingWishlists) {
        // Find the restaurant in registry to get coords
        const restaurant = registry.find((s: any) => 
          s.type === 'Restaurant' && s.name === wishlist.restaurant_id
        );

        if (!restaurant) continue;

        // Calculate distance
        const distance = getDistance(farm.lat, farm.lng, restaurant.lat, restaurant.lng);

        // Atlanta Logistics Hub Logic: 20-mile radius (also applies to Seattle for pilot)
        if (distance <= 20) {
          matches.push({
            listing_id: listing.externalKey || listing.produce_type,
            restaurant_id: restaurant.name,
            match_reason: `Wishlist Match: ${wishlist.produce_type} (${wishlist.priority} Priority)`,
            distance_miles: parseFloat(distance.toFixed(1)),
            status: 'Pending',
            created_at: new Date().toISOString()
          });
        }
      }
    }

    // 3. Persist Matches
    if (matches.length > 0) {
      await fetch(`https://baget.ai/api/public/databases/${MATCHES_DB}/rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: matches.map(m => ({
            externalKey: `MATCH-${m.listing_id}-${m.restaurant_id}-${Date.now()}`,
            data: m
          }))
        })
      });
    }

    return {
      success: true,
      match_count: matches.length,
      matches
    };

  } catch (error: any) {
    console.error('Matching Engine Error:', error);
    throw error;
  }
}
