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

### Farm Inventory Submission (New)
- **Endpoint**: `POST /api/inventory/submit`
- **Purpose**: General ingestion for harvest data. Deduplicates items and merges quantities.
- **Payload Schema**:
  ```json
  {
    "farm_id": "FARM-SNO-01",
    "items": [
      {
        "produce_type": "Wild Ramps",
        "quantity_lbs": 40,
        "unit_price": 14.25,
        "status": "In-Field"
      },
      {
        "produce_type": "Wild Ramps",
        "quantity_lbs": 10,
        "unit_price": 14.25,
        "status": "Packed"
      }
    ],
    "harvest_timestamp": "2026-04-26T06:15:00Z"
  }
  ```
- **Response**: Returns a list of `unique_items` with generated FSMA 204 lot codes.

### Farm Inventory Webhook (Batch 12 Refinement)
- **Endpoint**: `POST /api/inventory/webhook`
- **Authentication**: Header `x-fieldflow-secret` (Shared Secret)
- **Logic**: Deduplicates harvest items, merges quantities, and returns a unique harvest summary.

### Real-Time Logistics Tracking
- **Endpoint**: `POST /api/logistics/track`
- **Auth**: Header `x-courier-api-key`

### Terminal Listing API
- **Endpoint**: `POST /api/terminal/list`

## Deployment & Production
- **Live Site**: [https://baget-fieldflow.vercel.app](https://baget-fieldflow.vercel.app)
- **Year**: 2026 (FSMA 204 Compliance Active)

## Databases
- **FieldFlow_Farms**: Core farm profiles and acreages.
- **FieldFlow_Listings**: Real-time marketplace inventory state.
- **Seattle_Pilot_Registry**: GPS-enabled site registry for geofencing and proximity scoring.
