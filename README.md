# baget-fieldflow
FieldFlow Landing Page - Immediate Response Marketplace for Farm Surplus

## Features
- **Real-Time Logistics Tracking**: Webhook handler for 3PL status updates (`/api/logistics/track`).
- **Real-Time Surplus Sync**: Terminal-to-Marketplace API for instant listings.
- **Geographic Notification Engine**: Automated SMS alerts to kitchens within a 20-mile radius.
- **Farm Matching Algorithm**: Weighted recommendation engine for chefs based on history, proximity, and seasonality.
- **Stripe Integration**: One-click checkout for surplus lots with real-time status updates.
- **FSMA 204 Compliance**: Automated lot-code generation and digital ledger for professional kitchens.

## API Documentation

### Farm Inventory Webhook (Batch 12)
- **Endpoint**: `POST /api/inventory/webhook`
- **Authentication**: Header `x-fieldflow-secret` (Shared Secret)
- **Purpose**: High-velocity automated sync from farm ERP systems (Farmigo, AgSquared).
- **Payload Schema**:
  ```json
  {
    "farm_id": "FARM-SNO-01",
    "secret_key": "FF_SNO_2026_SECURE",
    "harvest_event": {
      "timestamp": "2026-04-26T06:15:00Z",
      "items": [
        {
          "produce_type": "Wild Ramps",
          "quantity_lbs": 40,
          "unit_price": 14.25,
          "status": "In-Field"
        }
      ]
    }
  }
  ```

### Real-Time Logistics Tracking
- **Endpoint**: `POST /api/logistics/track`
- **Auth**: Header `x-courier-api-key`
- **Payload**:
  ```json
  {
    "listingId": "listing_external_key",
    "status": "IN_TRANSIT",
    "courier_name": "John D.",
    "estimated_arrival": "2026-04-26T16:00:00Z"
  }
  ```

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

## Deployment & Production
- **Live Site**: [https://baget-fieldflow.vercel.app](https://baget-fieldflow.vercel.app)
- **Year**: 2026 (FSMA 204 Compliance Active)

## Databases
- **FieldFlow_Farms**: Core farm profiles and acreages.
- **FieldFlow_Listings**: Real-time marketplace inventory state.
- **Seattle_Pilot_Registry**: GPS-enabled site registry for geofencing and proximity scoring.
