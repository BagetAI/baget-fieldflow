# baget-fieldflow
FieldFlow Landing Page - Immediate Response Marketplace for Farm Surplus

## Features
- **Real-Time Surplus Sync**: Terminal-to-Marketplace API for instant listings.
- **Geographic Notification Engine**: Automated SMS alerts to kitchens within a 20-mile radius.
- **Farm Matching Algorithm**: Weighted recommendation engine for chefs based on history, proximity, and seasonality.
- **Stripe Integration**: One-click checkout for surplus lots with real-time status updates.
- **FSMA 204 Compliance**: Automated lot-code generation and digital ledger for professional kitchens.

## API Documentation

### Farm Matching Algorithm (v2)
- **Endpoint**: `GET /api/recommendations/[restaurantId]`
- **Purpose**: Suggests 3-5 farms for a restaurant to buy from based on "Supply-Triggered Demand."
- **Parameters**: `restaurantId` (e.g., `Stoneburner`, `Canlis`, `Aerlume`)
- **Ranking Weights**:
  - **Proximity (40%)**: Haversine distance from kitchen to field.
  - **Menu Alignment (40%)**: Matches current available gluts against historical procurement data.
  - **Inventory Depth (20%)**: Factors in harvest volume and freshness.

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
- **Purpose**: High-velocity automated sync from farm inventory systems (e.g., Square for Retail or custom ERPs).

## Deployment & Production
- **Live Site**: [https://baget-fieldflow.vercel.app](https://baget-fieldflow.vercel.app)
- **Year**: 2026 (FSMA 204 Compliance Active)

## Databases
- **FieldFlow_Farms**: Core farm profiles and acreages.
- **FieldFlow_Listings**: Real-time marketplace inventory state.
- **Seattle_Pilot_Registry**: GPS-enabled site registry for geofencing and proximity scoring.
