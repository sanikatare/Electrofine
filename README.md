# ElectroFine — E-Waste Collection & Kabadiwala Management System

ElectroFine connects households and businesses with local *kabadiwalas* (waste collectors) for
scheduled e-waste pickup, transparent per-kg pricing, cashless payments, and real-time pickup
tracking — with a full admin console for operations and reporting.

---

## 1. Overview

ElectroFine has three portals sharing one codebase:

- **Customer** — schedule pickups, pick a location on a map, track progress via QR code, pay, and rate the collector.
- **Kabadiwala** — view assigned pickups, manage availability, track daily/monthly earnings.
- **Admin** — manage customers, kabadiwalas, categories & pricing, moderate feedback, and export operational/financial reports.

---

## 2. Features

- Role-based authentication (Admin/Staff, Customer, Kabadiwala) via NextAuth Credentials
- Pickup request lifecycle: Pending -> Assigned -> In Progress -> Completed / Cancelled
- Per-category, versioned pricing with minimum weight & bonus amount
- Payments (Cash / UPI / Bank Transfer) with status tracking
- Customer feedback with admin moderation
- In-app notifications
- Pickup photo uploads via Cloudinary
- Google Maps location picker for pickup addresses
- QR code per pickup request linking to a public tracking page
- Admin dashboard with revenue, pickups, category, and kabadiwala performance charts
- CSV report exports (pickups, customers, kabadiwalas, payments, category-wise collection)
- PDF payment receipts
- Global search across customers, kabadiwalas, pickups, categories, and payments
- Reusable filters, pagination, skeleton loaders, empty states, and error boundaries
- Framer Motion animations (page transitions, scroll reveals, hover/press states)

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | MongoDB |
| ORM | Prisma |
| Auth | NextAuth (Auth.js) — Credentials provider |
| Validation | Zod |
| Forms | React Hook Form |
| Animation | Framer Motion |
| Charts | Recharts |
| Image hosting | Cloudinary |
| Maps | Google Maps JavaScript API |
| PDF | pdf-lib |
| QR codes | qrcode |

---

## 4. Folder Structure

```
app/
  (public)/               # Landing, marketing pages
  (auth)/                 # Login
  admin/                  # Admin-only pages (protected by middleware)
  customer/                # Customer-only pages
  kabadiwala/              # Kabadiwala-only pages
  track/[id]/              # Public QR tracking page
  api/
    auth/[...nextauth]/    # NextAuth route handler
    customers/, kabadiwalas/, categories/, pickups/, payments/, pricing/, feedback/
    notifications/         # Notification CRUD
    reports/                # CSV / revenue / waste-collection reports
    search/                  # Global search
    admin/dashboard/, customer/dashboard/, kabadiwala/dashboard/
  error.tsx, global-error.tsx
components/
  ui/                       # shadcn/ui primitives
  shared/                   # StatusBadge, Pagination, FilterBar, EmptyState, ErrorBoundary, skeletons, animations
  dashboard/                 # StatCard, ChartCard, chart components
  qr/, maps/, search/
lib/
  prisma.ts                 # Prisma client singleton
  auth.ts, auth.config.ts   # NextAuth configuration
  cloudinary.ts
  qr/, reports/, pdf/
  validations/               # Zod schemas
hooks/
  use-debounce.ts, use-query-params.ts, use-google-maps-script.ts
prisma/
  schema.prisma
  seed.ts
middleware.ts
```

---

## 5. Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="mongodb://localhost:27017/electrofine?replicaSet=rs0"

# NextAuth
AUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Cloudinary
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-maps-api-key"
```

---

## 6. Installation

```bash
git clone <repository-url>
cd electrofine
npm install
```

Additional packages used by the features documented here (install if not already present):

```bash
npm install cloudinary qrcode pdf-lib recharts framer-motion
npm install -D @types/qrcode @types/google.maps
```

---

## 7. Prisma Migration

```bash
npx prisma generate
npx prisma db push
```

> Two schema additions are required for the image-upload and feedback-moderation features:
> a `PickupImage` model, and `moderationStatus` / `moderationNote` / `moderatedAt` fields on
> `Feedback`. Add them to `schema.prisma` before running migrations if not already present.

---

## 8. Seed Command

Add to `package.json`:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Then run:

```bash
npx prisma db seed
```

This creates:
- 1 admin (`admin@electrofine.com` / `Admin@123`)
- 5 customers (password: `Customer@123`) with addresses
- 5 kabadiwalas across varied availability states
- 6 categories with active pricing
- 10 pickup requests spanning every status
- Payments for completed pickups
- Sample feedback and notifications

---

## 9. Running Locally

```bash
npm run dev
```

Visit `http://localhost:3000`. Log in at `/login` with any seeded account, or register a new customer via `POST /api/customers`.

---

## 10. Authentication

- Provider: NextAuth **Credentials**, one unified endpoint (`app/api/auth/[...nextauth]/route.ts`).
- Login payload: `{ identifier, password, userType: "ADMIN" | "CUSTOMER" | "KABADIWALA" }`.
- Session strategy: JWT, 7-day expiry.
- `middleware.ts` protects `/admin/*`, `/customer/*`, `/kabadiwala/*`, redirecting unauthenticated users to `/login` and wrong-role users to `/unauthorized`.
- Session shape: `session.user.{id, role, userType}` (typed via `types/next-auth.d.ts`).

---

## 11. API Overview

| Area | Base path | Notes |
|---|---|---|
| Customers | `/api/customers` | Admin list; public self-registration |
| Kabadiwalas | `/api/kabadiwalas` | Admin-managed |
| Categories | `/api/categories` | Public read; enable/disable endpoints |
| Pricing | `/api/pricing` | Versioned; auto-supersedes prior active price |
| Pickups | `/api/pickups` | Create/update/cancel/delete, role-scoped list |
| Pickup Images | `/api/pickups/[id]/images` | Cloudinary upload/delete |
| Pickup QR | `/api/pickups/[id]/qr` | PNG or data URL |
| Payments | `/api/payments` | Cash/UPI/Bank; Pending/Paid/Failed |
| Feedback | `/api/feedback` | Customer submits; `/[id]/moderate` for admin |
| Notifications | `/api/notifications` | Create/list/read/delete |
| Dashboards | `/api/admin/dashboard`, `/api/customer/dashboard`, `/api/kabadiwala/dashboard` (+ `/admin/dashboard/charts`) | Aggregated metrics |
| Reports | `/api/reports/[type]`, `/api/reports/revenue`, `/api/reports/waste-collection` | CSV/JSON exports |
| Search | `/api/search?q=` | Role-scoped global search |
| Tracking | `/track/[id]` | Public page, QR destination |

All mutating endpoints validate input with Zod and enforce role checks server-side (not just via middleware).

---

## 12. Deployment

1. Provision a MongoDB instance (MongoDB Atlas free tier, etc.) and set `DATABASE_URL`.
2. Set all environment variables from Section 5 in your hosting provider (Vercel, etc.).
3. Run `npx prisma db push` as part of your build/release step.
4. Ensure `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` match your production domain (QR codes and tracking links depend on this).
5. Deploy (`vercel deploy --prod` or equivalent).

---

## 13. Production Best Practices

- Never commit `.env`; use your platform's secret manager.
- Rotate `AUTH_SECRET` and Cloudinary/Google Maps keys periodically; restrict the Maps key by HTTP referrer.
- Run `npx prisma db push` in production pipelines to sync the schema.
- Add rate limiting in front of public endpoints (`/api/customers` POST, `/track/[id]`).
- Monitor `console.error` logs in API routes via your platform's log drain; replace with structured logging (e.g. pino) as the app grows.
- Back up the MongoDB database on a schedule and test restores.
- Keep the `PickupImage`/`Feedback` moderation schema fields (Section 7) in sync across environments before deploying image-upload or moderation features.
