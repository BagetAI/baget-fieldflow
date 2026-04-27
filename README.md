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

### Simple Inventory Add (New)
- **Endpoint**: `POST /api/inventory/add`
- **Purpose**: Lightweight ingestion for single produce items.
- **Payload Schema**:
  ```json
  {
    "produce_type": "Wild Ramps",
    "quantity": 40,
    "price": "$4.50/lb",
    "farm_name": "Local Roots Farm"
  }
  ```
- **Response**: Returns the created listing with an automated FSMA 204 lot code.

### Farm Inventory Submission (Batch)
- **Endpoint**: `POST /api/inventory/submit`
- **Purpose**: General ingestion for multi-item harvest data.
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
      }
    ]
  }
  ```

### Real-Time Logistics Tracking
- **Endpoint**: `POST /api/logistics/track`
- **Auth**: Header `x-courier-api-key`

## Deployment & Production
- **Live Site**: [https://baget-fieldflow.vercel.app](https://baget-fieldflow.vercel.app)
- **Year**: 2026 (FSMA 204 Compliance Active)

## Databases
- **FieldFlow_Farms**: Core farm profiles and acreages.
- **FieldFlow_Listings**: Real-time marketplace inventory state.
- **Seattle_Pilot_Registry**: GPS-enabled site registry for geofencing and proximity scoring.
