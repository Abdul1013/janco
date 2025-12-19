# Quick Setup Guide

## What Was Fixed

✅ **Pricing System** - Centralized, maintainable pricing logic
✅ **Booking Flow** - Clean navigation and data passing
✅ **Backend Routes** - Complete job management endpoints
✅ **Type Safety** - Proper Pydantic schemas

---

## File Changes Summary

### Frontend
```
App/
├── screens/
│   ├── BookingScreen.jsx          ✏️ UPDATED - proper job creation
│   └── PriceEstimateScreen.jsx    ✏️ UPDATED - uses pricing utility
├── utils/
│   └── pricing.js                 ✏️ UPDATED - centralized pricing
└── hooks/
    └── useJob.js                  (no changes needed)
```

### Backend
```
app/
├── routes/
│   ├── booking_routes.py          ✨ NEW - all booking endpoints
│   └── job_routes.py              (existing, can keep)
├── schema/
│   └── job_schema.py              ✏️ UPDATED - comprehensive schemas
└── main.py                        ✏️ UPDATED - imports booking_routes
```

---

## Running the Application

### Frontend
```bash
cd /Users/abdulhaqabdulrasheed/IT/JancoApp/frontend

# Install dependencies (if needed)
npm install

# Start expo
npm start
# or
expo start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

### Backend
```bash
cd /Users/abdulhaqabdulrasheed/IT/JancoApp/backend

# Create virtual environment (if not done)
python3 -m venv venv
source venv/bin/activate

# Install FastAPI (update requirements.txt!)
pip install fastapi uvicorn supabase python-dotenv

# Start server
uvicorn app.main:app --reload

# Server runs on http://localhost:8000
```

---

## Environment Setup

### Backend (.env file)
Create `/backend/.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anonymous-key
DATABASE_URL=postgresql://...
```

### Frontend (.env file)
Create `/frontend/.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anonymous-key
API_URL=http://localhost:8000
```

---

## Testing the Booking Flow

### 1. Test Pricing Calculation

**Open DevTools and test:**
```javascript
import { calculatePrice } from './App/utils/pricing.js';

// Test house cleaning with 3 rooms + kitchen
const result = calculatePrice('house_cleaning', {
  rooms: 3,
  toilets: 1,
  extras: { kitchen: true }
}, true); // true = use fixed pricing

console.log(result);
// Output:
// {
//   estimate: 37000,
//   breakdown: ["Standard House Cleaning (3-4 rooms): ₦35,000", "+ Kitchen Cleaning: ₦2,000"],
//   description: "MVP Fixed Pricing"
// }
```

### 2. Test Booking API

**Using cURL:**
```bash
# Test database connection
curl http://localhost:8000/test-connection

# Create a job
curl -X POST http://localhost:8000/jobs/create \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user",
    "service_type": "house_cleaning",
    "address": "123 Main St",
    "latitude": 7.3775,
    "longitude": 3.9470,
    "room_data": "[{\"room\":\"bedroom\",\"count\":3}]"
  }'

# Book a job
curl -X POST http://localhost:8000/jobs/book-job \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user",
    "janitor_id": "janitor-1",
    "service_type": "house_cleaning",
    "scheduled_time": "2025-11-20 10:00",
    "location": {
      "city": "Ibadan",
      "lat": 7.3775,
      "lng": 3.9470,
      "address_line": "123 Main St"
    }
  }'
```

### 3. Test UI Flow

1. **Open BookingScreen** in app
2. Select service type (House Cleaning)
3. Enter rooms: 3, toilets: 1
4. Check Kitchen extra
5. Click "Continue To Estimate"
6. **See PriceEstimateScreen** with breakdown
7. Toggle "Fixed Pricing" switch - should recalculate
8. Click "Continue to Select Janitor"
9. (Mock janitor list or test endpoint)

---

## Common Issues & Fixes

### Issue: `Module not found: 'pricing.js'`
**Solution:** Make sure you're using correct import path
```javascript
// ✅ Correct
import { calculatePrice } from '../utils/pricing';

// ❌ Wrong
import { calculatePrice } from '../utils/pricing.js';
```

### Issue: `Switch value is string "true", not boolean`
**Solution:** Already fixed! Make sure BookingScreen updated.
```javascript
// ✅ Fixed
const [useFixedPricing, setUseFixedPricing] = useState(true);

// ❌ Old code (removed)
const [useFixedPricing, setUseFixedPricing] = useState("true");
```

### Issue: Backend `/jobs/book-job` endpoint not found
**Solution:** Make sure main.py imports booking_routes:
```python
from app.routes import booking_routes
app.include_router(booking_routes.router)
```

### Issue: Pricing calculation returns 0
**Solution:** Check params are passed correctly:
```javascript
// Ensure numeric values
const params = {
  rooms: parseInt(rooms || 1, 10),  // Convert string to number
  toilets: parseInt(toilets || 0, 10),
  extras: extras || {}
};
```

---

## Pricing Configuration

To adjust prices, edit `/frontend/App/utils/pricing.js`:

```javascript
export const FIXED_PRICES = {
  house_cleaning: {
    basic: 24000,        // ← Change this
    standard: 35000,     // ← Or this
    premium: 50000,      // ← Or this
    kitchen: 2000,       // ← Extra charges
    livingRoom: 1500,
    windowCleaning: 1000,
  },
  // ... more categories
};

export const DYNAMIC_RATES = {
  house_cleaning: {
    per_room: 1500,      // ← Change this
    per_toilet: 800,
    kitchen: 2000,
  },
  // ... more
};
```

---

## Database Schema

Ensure these tables exist in Supabase:

### jobs table
```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  janitor_id UUID REFERENCES profiles(id),
  service_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_status TEXT DEFAULT 'unpaid',
  scheduled_date TEXT,
  scheduled_time TEXT,
  address TEXT,
  latitude FLOAT,
  longitude FLOAT,
  room_data JSONB,
  extras JSONB,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_jobs_user ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
```

---

## Next Tasks

- [ ] Test booking flow end-to-end
- [ ] Implement Paystack payment integration
- [ ] Add real-time job updates (WebSocket/subscriptions)
- [ ] Create admin dashboard for job tracking
- [ ] Add janitor assignment algorithm
- [ ] Implement SMS notifications (Termii)
- [ ] Add AI area estimation (OpenCV/YOLO)

---

## Documentation

For detailed info, see:
- `PRICING_BOOKING_FIX.md` - Complete refactoring details
- `API_REFERENCE.md` - API endpoints reference
- `README.md` - General project info

---

## Support

If you have issues:
1. Check the error message carefully
2. Look in the relevant doc file
3. Verify environment variables
4. Check Supabase connection
5. Review console logs
