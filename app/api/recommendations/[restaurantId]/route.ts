import { NextResponse } from 'next/server';

/**
 * FieldFlow Farm Matching Algorithm
 * Endpoint: GET /api/recommendations/[restaurantId]
 * 
 * Logic:
 * 1. Fetches restaurant coordinates from the Pilot Registry.
 * 2. Fetches current available farm gluts from Listings.
 * 3. Simulates restaurant order history preferences.
 * 4. Ranks farms based on Proximity (50%) and Inventory Match (50%).
 */

const PILOT_REGISTRY_DB_ID = '427a053f-75a8-461a-8463-265ecbb1eb30';
const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';

// Mock Order History Preferences for Pilot Sites
const RESTAURANT_PREFERENCES: Record<string, string[]> = {
  'Stoneburner': ['Wild Ramps', 'Green Garlic', 'Spring Greens'],
  'Canlis': ['Heirloom Tomatoes', 'Asparagus', 'Microgreens'],
  'Aerlume': ['Root Vegetables', 'Baby Spinach', 'Arugula'],
  'The Herbfarm': ['Wild Ramps', 'Spring Peas', 'Specialty Herbs'],
  'Art of the Table': ['Bok Choy', 'Heirloom Tomatoes', 'Rhubarb']
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Radius in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(
  request: Request,
  { params }: { params: { restaurantId: string } }
) {
  try {
    const { restaurantId } = params;

    // 1. Fetch Pilot Registry (Farms & Restaurants)
    const registryRes = await fetch(`https://baget.ai/api/public/databases/${PILOT_REGISTRY_DB_ID}/rows`);
    if (!registryRes.ok) throw new Error('Failed to fetch registry');
    const registry = await registryRes.json();

    // 2. Identify the target restaurant
    const restaurant = registry.find((s: any) => 
      s.type === 'Restaurant' && (s.name.includes(restaurantId) || restaurantId.includes(s.name))
    );

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found in pilot registry' }, { status: 404 });
    }

    // 3. Fetch current available listings
    const listingsRes = await fetch(`https://baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`);
    const listings = listingsRes.ok ? await listingsRes.json() : [];
    const availableListings = listings.filter((l: any) => l.status === 'Available');

    // 4. Get all farms from registry
    const farms = registry.filter((s: any) => s.type === 'Farm');

    // 5. Run Ranking Algorithm
    const preferences = RESTAURANT_PREFERENCES[restaurant.name] || ['Wild Ramps', 'Spring Greens'];
    
    const recommendations = farms.map((farm: any) => {
      // A. Proximity Score (0 to 1, higher is closer)
      const distance = calculateDistance(restaurant.lat, restaurant.lng, farm.lat, farm.lng);
      const proximityScore = Math.max(0, 1 - (distance / 50)); // Scaled against 50 miles

      // B. Inventory Match Score (0 to 1, based on preferences)
      const farmListings = availableListings.filter((l: any) => 
        l.farm_id && (l.farm_id.includes(farm.name) || farm.name.includes(l.farm_id))
      );
      
      const matchCount = farmListings.filter((l: any) => 
        preferences.some(p => l.produce_type.toLowerCase().includes(p.toLowerCase()))
      ).length;
      
      const matchScore = farmListings.length > 0 ? Math.min(1, matchCount / preferences.length) : 0;

      // C. Final Weighted Score
      const finalScore = (proximityScore * 0.5) + (matchScore * 0.5);

      return {
        farm_name: farm.name,
        distance_miles: distance.toFixed(1),
        current_gluts: farmListings.map((l: any) => l.produce_type),
        match_score: (matchScore * 100).toFixed(0) + '%',
        recommendation_score: finalScore.toFixed(2),
        priority: finalScore > 0.7 ? 'High' : finalScore > 0.4 ? 'Medium' : 'Low'
      };
    });

    // 6. Sort and Return Top 5
    const rankedRecommendations = recommendations
      .sort((a: any, b: any) => parseFloat(b.recommendation_score) - parseFloat(a.recommendation_score))
      .slice(0, 5);

    return NextResponse.json({
      restaurant: restaurant.name,
      last_updated: "2026-04-26T10:00:00Z",
      typical_buys: preferences,
      top_farm_matches: rankedRecommendations
    });

  } catch (error: any) {
    console.error('Recommendation API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
