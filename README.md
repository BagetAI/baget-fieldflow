# baget-fieldflow
FieldFlow Landing Page - Immediate Response Marketplace for Farm Surplus

## Features
- **Real-Time Surplus Sync**: Terminal-to-Marketplace API for instant listings.
- **Geographic Notification Engine**: Automated SMS alerts to kitchens within a 20-mile radius.
- **Farm Matching Algorithm**: Data-driven recommendations for restaurants based on history, proximity, and seasonality.
- **Stripe Integration**: One-click checkout for surplus lots.
- **FSMA 204 Compliance**: Automated lot-code generation and digital ledger logs.

## API Documentation

### Farm Matching Algorithm
- **Endpoint**: `GET /api/recommendations/[restaurantId]`
- **Purpose**: Suggests 3-5 farms for a restaurant to buy from this week.
- **Parameters**: `restaurantId` (e.g., `Stoneburner`, `Canlis`)
- **Logic**: Ranks farms based on typical order patterns, current seasonal gluts, and geofenced proximity.

### Terminal Listing API
- **Endpoint**: `POST /api/terminal/list`
- **Payload**:
  ```json
  {
    "produce_type": "Wild Ramps",
    "quantity": 40,
    "price": "$4.50",
    "farm_id": "FARM-SEA-001"
  }
  ```

### Farm Inventory Webhook
- **Endpoint**: `POST /api/inventory/webhook`
- **Purpose**: High-velocity automated sync from farm inventory systems.

## Databases
- **FieldFlow_Farms**: Core farm profiles.
- **FieldFlow_Listings**: Active marketplace inventory.
- **Seattle_Pilot_Registry**: GPS-enabled site registry for proximity filtering.
