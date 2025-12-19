# 🎯 Quick Visual Guide

## System at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                  CO-JANITORS SYSTEM                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  FRONTEND (React Native/Expo)                              │
│  ┌───────────────────────────────────────────────┐          │
│  │  BookingScreen → PriceEstimate → NearbyJan  │          │
│  │         ↓              ↓              ↓      │          │
│  │  Get Details  Calculate Price  Choose Janitor           │
│  │  ✓ Service    ✓ Breakdown      ✓ Distance  │          │
│  │  ✓ Date/Time  ✓ Formatting     ✓ Rating    │          │
│  │  ✓ Location   ✓ Toggle Mode    ✓ Profile   │          │
│  └───────────────────────────────────────────────┘          │
│                         ↓                                    │
│  ┌───────────────────────────────────────────────┐          │
│  │   Pricing Utility (pricing.js)                │          │
│  │   calculatePrice(type, params, useFixed)     │          │
│  │   ├─ Fixed tiers (Basic/Standard/Premium)    │          │
│  │   ├─ Dynamic rates (per room, per item)      │          │
│  │   ├─ Accurate breakdown                      │          │
│  │   └─ Currency formatting                     │          │
│  └───────────────────────────────────────────────┘          │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  BACKEND (FastAPI)                                         │
│  ┌───────────────────────────────────────────────┐          │
│  │  POST /jobs/book-job (Main Endpoint)          │          │
│  │  ├─ Validate BookJobPayload                  │          │
│  │  ├─ Create job in Supabase                   │          │
│  │  ├─ Store metadata (price, breakdown)        │          │
│  │  └─ Return job object                        │          │
│  │                                               │          │
│  │  Other Endpoints:                            │          │
│  │  ├─ GET  /jobs/{job_id}                      │          │
│  │  ├─ GET  /jobs/user/{user_id}               │          │
│  │  ├─ PATCH /jobs/{job_id}                     │          │
│  │  └─ DELETE /jobs/{job_id}                    │          │
│  └───────────────────────────────────────────────┘          │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  DATABASE (Supabase/PostgreSQL)                            │
│  ┌───────────────────────────────────────────────┐          │
│  │  jobs table                                    │          │
│  │  ├─ user_id ──────→ profiles (user)          │          │
│  │  ├─ janitor_id ───→ profiles (janitor)       │          │
│  │  ├─ service_type                              │          │
│  │  ├─ status (pending/confirmed/...)           │          │
│  │  ├─ payment_status                            │          │
│  │  ├─ location (JSON)                           │          │
│  │  ├─ metadata (JSON: price, breakdown)        │          │
│  │  └─ timestamps                                │          │
│  └───────────────────────────────────────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Booking Flow Visual

```
START
  │
  ▼
┌─────────────────────────────┐
│   BookingScreen             │
│ 1. Select service           │
│ 2. Enter rooms/items        │
│ 3. Pick date & time         │
│ 4. Add notes                │
└──────────┬──────────────────┘
           │
           │ handleBookingSubmit()
           ├─ Validate input
           ├─ createJob() hook
           └─ Navigate → PriceEstimate
           │
           ▼
┌─────────────────────────────┐
│   PriceEstimateScreen       │
│ 1. Show service details     │
│ 2. Calculate price          │
│ 3. Show breakdown           │
│ 4. Toggle pricing mode      │
└──────────┬──────────────────┘
           │
           │ Button: "Continue to Select Janitor"
           │
           ▼
┌─────────────────────────────┐
│   NearbyJanitorsScreen      │
│ 1. Fetch nearby janitors    │
│ 2. Show list with details   │
│ 3. User selects janitor     │
│ 4. Show confirmation        │
└──────────┬──────────────────┘
           │
           │ handleBookWithJanitor()
           │
           ▼
┌─────────────────────────────┐
│   POST /jobs/book-job       │
│ (Backend API Call)          │
│ ├─ Validate payload         │
│ ├─ Insert to database       │
│ └─ Return job ID            │
└──────────┬──────────────────┘
           │
           │ Success
           ▼
┌─────────────────────────────┐
│   JobStatusScreen           │
│ ✓ Booking Confirmed         │
│ ✓ Janitor assigned          │
│ ✓ Ready for chat            │
└─────────────────────────────┘
           │
           ▼
         END
```

---

## Pricing Calculation Flow

```
calculatePrice(type, params, useFixed)
│
├─ IF useFixed = true
│  │
│  └─ calculateFixedPrice()
│     ├─ Determine tier (Basic/Standard/Premium)
│     ├─ Look up base price
│     ├─ Add extras if selected
│     └─ Return total
│        │
│        ├─ Basic (1-2): ₦24,000
│        ├─ Standard (3-4): ₦35,000
│        └─ Premium (5+): ₦50,000
│
├─ ELSE useFixed = false
│  │
│  └─ calculateDynamicPrice()
│     ├─ Multiply rooms × rate
│     ├─ Multiply items × rate
│     ├─ Add extras if selected
│     └─ Return total
│        │
│        ├─ Rooms: 3 × ₦1,500 = ₦4,500
│        ├─ Items: 50 × ₦300 = ₦15,000
│        └─ Extras: +₦2,000
│
└─ Return Object
   ├─ estimate: 37000
   ├─ breakdown: ["item 1", "item 2"]
   ├─ description: "MVP Fixed Pricing"
   └─ useFixed: true

Display to User:
┌──────────────────────────┐
│ Service: House Cleaning  │
│ Date: 2025-11-20 10:00   │
│                          │
│ Breakdown:               │
│ - Standard (3-4): 35k    │
│ - Kitchen: 2k            │
│                          │
│ Total: ₦37,000           │
└──────────────────────────┘
```

---

## Key Concepts

### 🎯 Fixed Pricing (MVP)
```
Tiers based on complexity:
- Basic (1-2 rooms): ₦24,000
- Standard (3-4 rooms): ₦35,000
- Premium (5+ rooms): ₦50,000

Best for: Quick quotes, consistency
Use when: MVP, simplicity matters
```

### 📊 Dynamic Pricing
```
Per-unit rates:
- House: ₦1,500 per room, ₦800 per toilet
- Laundry: ₦300 per item, ₦500 ironing

Best for: Accuracy, flexibility
Use when: Scalability needed
```

### 💾 Data Storage
```
Jobs Table:
├─ Core: id, user_id, janitor_id, service_type
├─ Status: status, payment_status
├─ Location: address, latitude, longitude
├─ Details: room_data, extras, notes
└─ Metadata: JSON with price & breakdown
```

---

## Import Quick Reference

### Frontend

```javascript
// Pricing utility
import { 
  calculatePrice, 
  formatPrice, 
  getServiceLabel 
} from '../utils/pricing';

// Result
const priceData = calculatePrice(
  'house_cleaning', 
  { rooms: 3, extras: { kitchen: true } },
  true
);
// → { estimate, breakdown, description, useFixed }
```

### Backend

```python
# Schemas
from app.schema.job_schema import (
  JobCreate,
  BookJobPayload,
  JobResponse
)

# Routes
from app.routes import booking_routes
app.include_router(booking_routes.router)
```

---

## Testing Quick Commands

### Frontend (React)
```bash
cd frontend
npm start
# Then navigate: BookingScreen → PriceEstimate → NearbyJanitors
```

### Backend (FastAPI)
```bash
cd backend
uvicorn app.main:app --reload
# Visit: http://localhost:8000/test-connection
```

### API Test (cURL)
```bash
# Test database
curl http://localhost:8000/test-connection

# Book a job
curl -X POST http://localhost:8000/jobs/book-job \
  -H "Content-Type: application/json" \
  -d '{"user_id":"u1","janitor_id":"j1",...}'
```

---

## Files at a Glance

| File | Lines | Purpose |
|------|-------|---------|
| `pricing.js` | 450 | Pricing engine |
| `BookingScreen.jsx` | 300 | User input |
| `PriceEstimateScreen.jsx` | 200 | Price display |
| `booking_routes.py` | 140 | API endpoints |
| `job_schema.py` | 80 | Data validation |

---

## Status Transitions

```
Job Status Flow:
pending ──→ confirmed ──→ in_progress ──→ completed
         ↓
       cancelled (user cancels)

Payment Status Flow:
unpaid ──→ pending ──→ paid
       ↓
     failed (retry)
```

---

## Common Prices

```
HOUSE CLEANING (Fixed):
- Basic (1-2 rooms): ₦24,000
- Standard (3-4 rooms): ₦35,000
- Premium (5+ rooms): ₦50,000
- Kitchen: ₦2,000
- Living Room: ₦1,500
- Windows: ₦1,000

LAUNDRY (Fixed):
- Per item: ₦300
- Ironing: ₦500/item
- Delicates: ₦100/item

FUMIGATION:
- Flat rate: ₦10,000
```

---

## Feature Checklist

```
✅ Fixed pricing with tiers
✅ Dynamic pricing with rates
✅ Accurate cost breakdowns
✅ Toggle pricing modes
✅ Complete booking flow
✅ Job CRUD operations
✅ User/Janitor management
✅ Proper error handling
✅ Type-safe backend
✅ Comprehensive documentation
```

---

## Next Steps (Priority Order)

1. **Test everything** - Run through booking flow
2. **Fix any issues** - Debug using the docs
3. **Add payment** - Integrate Paystack
4. **Real-time updates** - Add WebSocket subscriptions
5. **AI features** - Add area estimation
6. **Admin dashboard** - Monitor jobs

---

## Emergency Contact Points

**Wrong pricing?** → Check `pricing.js`
**Booking fails?** → Check `booking_routes.py` logs
**UI looks wrong?** → Check component state
**API 404?** → Check router imports in `main.py`
**Database error?** → Check Supabase credentials

---

This visual guide should give you a quick overview of everything!
