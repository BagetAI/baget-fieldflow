# baget-fieldflow
FieldFlow Landing Page - Immediate Response Marketplace for Farm Surplus

## Features
- **Real-Time Surplus Sync**: Terminal-to-Marketplace API for instant listings.
- **Geographic Notification Engine**: Automated SMS alerts to kitchens within a 20-mile radius.
- **Stripe Integration**: One-click checkout for surplus lots.
- **FSMA 204 Compliance**: Automated lot-code generation and digital ledger logs.

## API Documentation

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
- **Action**: Publishes to database and triggers notifications to nearby Seattle pilot sites.

## Databases
- **FieldFlow_Farms**: Core farm profiles.
- **FieldFlow_Listings**: Active marketplace inventory.
- **Seattle_Pilot_Registry**: GPS-enabled site registry for proximity filtering.
