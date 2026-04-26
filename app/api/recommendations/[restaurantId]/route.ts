import { NextResponse } from 'next/server';

/**
 * FieldFlow Recommendation Engine API
 * Endpoint: GET /api/recommendations/[restaurantId]
 * 
 * Purpose: Analyzes restaurant order history, current seasonal inventory, 
 * and proximity to suggest top 3-5 farms for procurement this week.
 * 
 * Current Date: April 26, 2026
 */

const REGISTRY_DB_ID = '427a053f-75a8-461a-8463-265ecbb1eb30';
const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';

// Mock Order History Preferences for Pilot Sites
const RESTAURANT_PROFILES: Record<string, { typical_buys: string[] }> = {
  'Stoneburner': { typical_buys: ['Wild Ramps', 'Green Garlic', 'Spring Greens', 'Baby Spinach'] },
  'Canlis': { typical_buys: ['Heirloom Tomatoes', 'Asparagus', 'Microgreens', 'Specialty Herbs'] },
  'Aerlume': { typical_buys: ['Root Vegetables', 'Baby Spinach', 'Arugula', 'Bok Choy'] },
  'The Herbfarm': { typical_buys: ['Wild Ramps', 'Spring Peas', 'Specialty Herbs', 'Ramps'] },
  'Art of the Table': { typical_buys: ['Bok Choy', 'Heirloom Tomatoes', 'Rhubarb', 'Spring Peas'] }
};

/**
 * Haversine distance helper (Miles)
 */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
    const registryRes = await fetch(`https://baget.ai/api/public/databases/${REGISTRY_DB_ID}/rows`);
    if (!registryRes.ok) throw new Error('Failed to fetch registry data');
    const registry = await registryRes.json();

    // 2. Identify the target restaurant (partial match support)
    const restaurant = registry.find((s: any) => 
      s.type === 'Restaurant' && 
      (s.name.toLowerCase().includes(restaurantId.toLowerCase()) || 
       restaurantId.toLowerCase().includes(s.name.toLowerCase()))
    );

    if (!restaurant) {
      return NextResponse.json({ 
        error: 'Restaurant not found', 
        message: `No restaurant matching '${restaurantId}' found in our pilot hubs.` 
      }, { status: 404 });
    }

    // 3. Fetch current available listings (Seasonality Signal)
    const listingsRes = await fetch(`https://baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`);
    const listings = listingsRes.ok ? await listingsRes.json() : [];
    const availableListings = listings.filter((l: any) => l.status === 'Available');

    // 4. Run Matching Algorithm
    const profile = RESTAURANT_PROFILES[restaurant.name] || { typical_buys: ['Seasonal Greens', 'Spring Alliums'] };
    const farms = registry.filter((s: any) => s.type === 'Farm');

    const recommendations = farms.map((farm: any) => {
      // A. Proximity Score (Weight: 40%)
      // Scale: 1.0 (0 miles) to 0.0 (50+ miles)
      const distance = getDistance(restaurant.lat, restaurant.lng, farm.lat, farm.lng);
      const proximityScore = Math.max(0, 1 - (distance / 50));

      // B. History Match Score (Weight: 40%)
      // How many of their typical buys are currently listed by this farm?
      const farmListings = availableListings.filter((l: any) => 
        l.farm_id && (l.farm_id.toLowerCase().includes(farm.name.toLowerCase()) || 
                      farm.name.toLowerCase().includes(l.farm_id.toLowerCase()))
      );

      const itemsInStock = farmListings.map((l: any) => l.produce_type.toLowerCase());
      const matchedItems = profile.typical_buys.filter(item => 
        itemsInStock.some(stock => stock.includes(item.toLowerCase()))
      );
      
      const historyScore = profile.typical_buys.length > 0 
        ? matchedItems.length / profile.typical_buys.length 
        : 0;

      // C. Freshness/Volume Score (Weight: 20%)
      // Based on total quantity of relevant items available
      const volume = farmListings.reduce((sum: number, l: any) => sum + (parseFloat(l.quantity) || 0), 0);
      const volumeScore = Math.min(1, volume / 100); // Max score at 100lbs

      // Weighted Calculation
      const finalScore = (proximityScore * 0.4) + (historyScore * 0.4) + (volumeScore * 0.2);

      return {
        farm_name: farm.name,
        distance_miles: distance.toFixed(1),
        match_reason: matchedItems.length > 0 
          ? `Harvesting your typical items: ${matchedItems.slice(0, 2).join(', ')}` 
          : farmListings.length > 0 
            ? "Fresh gluts currently available" 
            : "Proximity anchor farm",
        available_produce: farmListings.map((l: any) => l.produce_type),
        scores: {
          proximity: proximityScore.toFixed(2),
          alignment: historyScore.toFixed(2),
          inventory: volumeScore.toFixed(2)
        },
        total_score: finalScore.toFixed(2)
      };
    });

    // 5. Rank and Filter (3-5 farms)
    const rankedFarms = recommendations
      .sort((a: any, b: any) => parseFloat(b.total_score) - parseFloat(a.total_score))
      .slice(0, 5);

    // 6. Return Polished JSON
    return NextResponse.json({
      recommendation_id: `REC-${Date.now()}`,
      generated_at: new Date().toISOString(),
      context: {
        restaurant: restaurant.name,
        typical_menu_needs: profile.typical_buys,
        hub_status: "Active"
      },
      recommendations: rankedFarms,
      summary: `We found ${rankedFarms.length} supply partners for ${restaurant.name} based on today's morning harvest and your proximity to the Seattle/Atlanta corridors.`
    });

  } catch (error: any) {
    console.error('Recommendation API Runtime Error:', error);
    return NextResponse.json({ 
      error: 'Internal Logic Error', 
      details: error.message 
    }, { status: 500 });
  }
}
