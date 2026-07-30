# Electrofine

> Schedule e-waste pickups, track your collector in real time, and get paid fairly for what you recycle.

Electrofine is a modern e-waste recycling platform that helps individuals and businesses dispose of electronic waste responsibly. Users can schedule pickups, monitor collector location in real time, and receive transparent, fair payouts based on recyclable value.

- Convenient pickup scheduling
- Live collector tracking
- Transparent pricing and payouts
- Digitized recycling records for trust and accountability

---

## Core Features

### 1) Smart Pickup Scheduling
- Book pickup slots based on availability and location.
- Add item details (device type, quantity, condition, approximate weight).
- Reschedule or cancel pickups within allowed windows.

### 2) Real-Time Collector Tracking
- Track assigned collectors on a live map.
- View ETA updates and status transitions:
  - `Scheduled`
  - `Collector Assigned`
  - `On the Way`
  - `Arrived`
  - `Collected`
  - `Completed`

### 3) Fair Payout Engine
- Dynamic valuation based on:
  - Device category
  - Material recovery potential
  - Item condition
  - Current pricing bands
- Transparent quote breakdown before confirmation.
- Payout status tracking (Pending → Processed → Paid).

### 4) User Dashboard
- Pickup history and statuses
- Earnings summary
- Recycling impact metrics (e.g., kg recycled, CO₂ avoided)

### 5) Collector Workflow
- Route-based pickup assignments
- Navigation and pickup confirmation
- Item verification and final weight/condition input
- Completion + proof capture

---

## How It Works

1. User requests pickup
   - Enters address, preferred slot, and item details.
2. System assigns collector
   - Based on area, route, and availability.
3. Collector heads to location
   - User tracks movement live.
4. Collection and verification
   - Items are checked and recorded.
5. Final valuation and payout
   - User receives fair payment and digital receipt.

---

## Tech Stack

Given the repository language composition (**TypeScript ~99.2%**), Electrofine is designed as a TypeScript-first platform.

### Suggested stack (customize as needed):
- Frontend: React / Next.js (TypeScript)
- Backend: Node.js + Express/NestJS (TypeScript)
- Database: PostgreSQL
- ORM: Prisma / TypeORM
- Realtime: WebSockets / Socket.IO
- Maps & Geolocation: Google Maps / Mapbox
- Auth: JWT + refresh tokens / OAuth
- Payments/Payouts: Razorpay / Stripe / Bank transfer integrations
- Infra: Docker, CI/CD (GitHub Actions), cloud deployment

---

## Architecture Overview

Electrofine can be structured into core modules:

- Auth & Users
- Pickup Management
- Collector Operations
- Realtime Tracking
- Pricing & Payouts
- Notifications (SMS/Email/Push)
- Admin & Reporting

High-level flow:

- Client apps call API services.
- API persists data to database.
- Tracking service streams collector coordinates to subscribed clients.
- Pricing service computes valuation.
- Notification service updates users at each milestone.

---

## Getting Started

> Adjust commands based on your package manager and actual project setup.

### Prerequisites
- Node.js 18+
- npm / pnpm / yarn
- PostgreSQL
- Git

### Installation

```bash
git clone https://github.com/sanikatare/Electrofine.git
cd Electrofine
npm install
```

### Run locally

```bash
npm run dev
```

### Build

```bash
npm run build
npm start
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/electrofine

# Auth
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Realtime / Maps
MAPS_API_KEY=your_maps_api_key
TRACKING_PROVIDER=mapbox

# Notifications
EMAIL_PROVIDER_API_KEY=your_email_key
SMS_PROVIDER_API_KEY=your_sms_key

# Payments
PAYMENT_PROVIDER=stripe
PAYMENT_SECRET_KEY=your_payment_secret
WEBHOOK_SECRET=your_webhook_secret
```

> Never commit `.env` or production secrets.

---

## Scripts

Common scripts (example):

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "prisma migrate dev",
    "db:seed": "prisma db seed"
  }
}
```

---

## Project Structure

Example TypeScript-first structure:

```text
Electrofine/
├─ src/
│  ├─ app/                  # App routes/pages (if Next.js)
│  ├─ components/           # Reusable UI components
│  ├─ modules/
│  │  ├─ auth/
│  │  ├─ pickups/
│  │  ├─ collectors/
│  │  ├─ tracking/
│  │  ├─ pricing/
│  │  └─ payouts/
│  ├─ lib/                  # Helpers, clients, configs
│  ├─ services/             # Business logic
│  ├─ server/               # API/server setup
│  └─ types/                # Shared TypeScript types
├─ prisma/                  # DB schema and migrations
├─ tests/                   # Unit/integration tests
├─ .env.example
├─ package.json
└─ README.md
```

---

## API Design (Suggested)

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`

### Pickups
- `POST /api/pickups`
- `GET /api/pickups/:id`
- `PATCH /api/pickups/:id/reschedule`
- `PATCH /api/pickups/:id/cancel`
- `GET /api/pickups?status=scheduled`

### Tracking
- `GET /api/tracking/:pickupId`
- `WS /ws/tracking/:pickupId`

### Pricing & Payout
- `POST /api/pricing/estimate`
- `POST /api/payouts/:pickupId/process`
- `GET /api/payouts/:pickupId/status`

---

## Realtime Tracking Flow

1. Collector app periodically sends coordinates.
2. Backend validates and stores latest location.
3. Tracking events published via WebSocket channel.
4. User clients subscribed to pickup channel receive:
   - live position
   - updated ETA
   - status change events

---

## Pickup & Pricing Logic

Suggested valuation factors:

- Base price by e-waste category
- Condition multiplier (`new`, `usable`, `damaged`, `scrap`)
- Weight/quantity adjustment
- Market adjustment coefficient
- Serviceability/transport considerations

**Final payout formula (example):**

`finalAmount = (baseRate × conditionFactor × quantityFactor × marketFactor) - serviceFee`

Keep this transparent and auditable in user-facing receipts.

---

## Security & Privacy

- Hash passwords with bcrypt/argon2
- Short-lived access tokens + refresh rotation
- Role-based access (user / collector / admin)
- Input validation at API boundaries
- Rate limiting + abuse protection
- Signed webhooks for payout events
- Encryption for sensitive data at rest/in transit
- Minimal location retention policy for privacy compliance

---

## Testing Strategy

- Unit tests: pricing engine, status transitions, utility logic
- Integration tests: pickup lifecycle, payout processing, auth
- E2E tests: booking to completion workflow
- Load tests: realtime tracking throughput
- Type safety checks: strict TypeScript + linting in CI

---

## Roadmap

- [ ] Multi-city serviceability support
- [ ] AI-assisted image-based item identification
- [ ] Smart route optimization for collectors
- [ ] Carbon impact certificates for users/businesses
- [ ] B2B bulk e-waste pickup workflows
- [ ] Wallet + instant payout options
- [ ] Native mobile apps

---

## License

Add your preferred license (e.g., MIT) in a `LICENSE` file.

---
