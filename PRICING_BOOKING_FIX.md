# 🔧 Pricing & Booking System - Fixes & Improvements

## Summary of Changes

I've completely refactored and fixed your pricing and booking system across frontend and backend. Here's what was improved:

---

## 📱 Frontend Changes

### 1. **Centralized Pricing Utility** (`App/utils/pricing.js`)

**Created a reusable pricing engine supporting both fixed and dynamic pricing:**

```javascript
import { calculatePrice, formatPrice, getServiceLabel } from '../utils/pricing';

// Single function handles all pricing logic
const priceData = calculatePrice(
  'house_cleaning',
  { rooms: 3, toilets: 1, extras: { kitchen: true } },
  useFixed = true
);

// Returns: { estimate: 35000, breakdown: [...], description: "..." }
```

**Features:**
- ✅ **Fixed pricing** (MVP): Tiered by service complexity (basic/standard/premium)
- ✅ **Dynamic pricing**: Per-unit rates (₦/room, ₦/item, etc)
- ✅ **Accurate breakdowns**: Itemized cost display
- ✅ **Easy to maintain**: All rates in one place
- ✅ **Service labels**: Auto-convert enum to display text

**Pricing Tiers:**
```
House Cleaning (Fixed):
- Basic (1-2 rooms): ₦24,000
- Standard (3-4 rooms): ₦35,000
- Premium (5+ rooms): ₦50,000
- Extras: Kitchen (+₦2,000), Living Room (+₦1,500), Windows (+₦1,000)

Laundry (Fixed):
- ₦300 per item
- Ironing: +₦500/item
- Delicates: +₦100/item

Fumigation: ₦10,000 flat
```

---

### 2. **Fixed PriceEstimateScreen** (`App/screens/PriceEstimateScreen.jsx`)

**Before:**
- ❌ Switch state was string "true" not boolean
- ❌ Hard-coded prices mixed with logic
- ❌ Inaccurate breakdowns
- ❌ Poor UX for pricing mode toggle

**After:**
- ✅ Boolean Switch state management
- ✅ Uses centralized `calculatePrice()` utility
- ✅ Accurate breakdown with currency formatting
- ✅ Visual indicator showing pricing mode (Fixed vs Dynamic)
- ✅ Better dark theme styling
- ✅ Proper data passing to next screen

**Usage:**
```jsx
const priceData = calculatePrice(category, {
  rooms: parseInt(rooms || 1, 10),
  toilets: parseInt(toilets || 0, 10),
  clothesCount: parseInt(clothesCount || 0, 10),
  extras: extras || {},
}, useFixedPricing);

const { estimate, breakdown, description } = priceData;
```

---

### 3. **Fixed BookingScreen** (`App/screens/BookingScreen.jsx`)

**Before:**
- ❌ `createJob` hook was commented out (disabled)
- ❌ Navigation to wrong screen name ("EstimateScreen" doesn't exist)
- ❌ Data validation in button callback (messy)
- ❌ No loading state during booking

**After:**
- ✅ `useJob()` hook properly integrated
- ✅ Dedicated `handleBookingSubmit()` function
- ✅ Proper validation and error handling
- ✅ Loading state prevents double-submission
- ✅ Navigates to correct "PriceEstimate" screen
- ✅ Passes all necessary data with proper types

**Booking Flow:**
```
BookingScreen 
  → (collect service details)
  → PriceEstimate 
    → (show cost breakdown)
  → NearbyJanitors 
    → (choose janitor)
  → JobStatus 
    → (track progress)
```

---

## 🔌 Backend Changes

### 1. **Enhanced Job Schema** (`app/schema/job_schema.py`)

**Added comprehensive Pydantic models:**

```python
class JobCreate(BaseModel):
    """For creating jobs from mobile app"""
    user_id: str
    janitor_id: Optional[str] = None
    service_type: str
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    room_data: Optional[str] = None  # JSON
    extras: Optional[str] = None  # JSON
    notes: Optional[str] = None

class BookJobPayload(BaseModel):
    """For booking with janitor"""
    user_id: str
    janitor_id: str
    service_type: str
    scheduled_time: str
    location: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None
```

---

### 2. **New Booking Routes** (`app/routes/booking_routes.py`)

**Complete booking endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/jobs/create` | POST | Create a job (internal) |
| `/jobs/book-job` | POST | Book job with specific janitor |
| `/jobs/{job_id}` | GET | Fetch single job |
| `/jobs/user/{user_id}` | GET | Get user's jobs (filterable by status) |
| `/jobs/{job_id}` | PATCH | Update job status/payment |
| `/jobs/{job_id}` | DELETE | Cancel job (if pending) |

**Example Request:**
```bash
POST /jobs/book-job
{
  "user_id": "user-123",
  "janitor_id": "janitor-456",
  "service_type": "house_cleaning",
  "scheduled_time": "2025-11-20 10:00",
  "location": {
    "city": "Ibadan",
    "lat": 7.3775,
    "lng": 3.9470,
    "address_line": "123 Awolowo Road"
  },
  "metadata": {
    "priceEstimate": 35000,
    "breakdown": ["₦35,000 Standard (3-4 rooms)", "₦2,000 Kitchen"],
    "notes": "Please use hypoallergenic products"
  }
}
```

---

### 3. **Updated Main Router** (`app/main.py`)

**Imports new booking_routes:**
```python
from app.routes import job_routes, chat_routes, janitor_routes, booking_routes

app.include_router(booking_routes.router)  # NEW
```

---

## 🚀 How to Use

### Frontend Booking Flow:

1. **BookingScreen**: User selects service, date, time, details
2. **Button Press**: Calls `handleBookingSubmit()`
3. **PriceEstimate**: Uses `calculatePrice()` to show cost
4. **Toggle Mode**: Switch between Fixed/Dynamic pricing
5. **NearbyJanitors**: Fetches janitors, user selects one
6. **Book Job**: POST to `/jobs/book-job` backend endpoint
7. **JobStatus**: Track real-time updates

### Backend Job Creation:

```javascript
// Frontend calls this
const response = await fetch('${API_URL}/jobs/book-job', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: profile.id,
    janitor_id: selectedJanitor.id,
    service_type: 'house_cleaning',
    scheduled_time: '2025-11-20 10:00',
    location: { lat: 7.3775, lng: 3.9470, ... },
    metadata: { priceEstimate: 35000, ... }
  })
});
```

---

## 📊 Pricing Examples

### House Cleaning (3 rooms, kitchen)

**Fixed Pricing:**
- Base (3-4 rooms): ₦35,000
- Kitchen: ₦2,000
- **Total: ₦37,000**

**Dynamic Pricing:**
- 3 rooms × ₦1,500: ₦4,500
- Kitchen: ₦2,000
- **Total: ₦6,500** ← Much cheaper!

### Laundry (50 items with ironing)

**Fixed:**
- 50 items × ₦300: ₦15,000
- Ironing: ₦25,000
- **Total: ₦40,000**

**Dynamic:**
- 50 items × ₦300: ₦15,000
- Ironing × 50: ₦25,000
- **Total: ₦40,000** ← Same

---

## 🐛 Bugs Fixed

| Bug | Before | After |
|-----|--------|-------|
| Switch state | `"true"` (string) | `true` (boolean) |
| Missing imports | `createJob` commented out | Properly imported & used |
| Wrong screen nav | "EstimateScreen" → 404 | "PriceEstimate" → ✓ |
| No loading state | Double submission possible | `isBooking` prevents it |
| Validation mixed with nav | In button callback | Dedicated function |
| Hard-coded prices | Scattered throughout | Centralized + maintainable |
| Bad breakdowns | Showed wrong totals | Accurate itemized lists |

---

## ✅ Testing Checklist

- [ ] Test BookingScreen → PriceEstimate navigation
- [ ] Toggle pricing mode and verify calculations
- [ ] Verify breakdown items are correct
- [ ] Test NearbyJanitors selection
- [ ] Mock booking endpoint response
- [ ] Test with different room counts
- [ ] Test laundry pricing with extras
- [ ] Test backend `/test-connection` endpoint
- [ ] Test `/jobs/book-job` POST request

---

## 🔄 Next Steps

1. **Test on device/emulator**
   ```bash
   cd frontend
   npm start
   # or
   expo start
   ```

2. **Verify backend routes** 
   ```bash
   curl http://localhost:8000/test-connection
   curl -X POST http://localhost:8000/jobs/book-job \
     -H "Content-Type: application/json" \
     -d '{"user_id":"test","janitor_id":"jan1",...}'
   ```

3. **Connect to real Supabase**
   - Ensure tables exist: `jobs`, `profiles`, `janitors`
   - Test database connectivity

4. **Implement payment flow** (Paystack)
   - Add payment status updates
   - Validate transaction before confirming job

5. **Add real-time updates**
   - Replace polling with Supabase subscriptions
   - Listen to job status changes

---

## 📝 Code Quality

- ✅ Clear separation of concerns
- ✅ Reusable utilities
- ✅ Proper TypeScript/JSDoc comments
- ✅ Comprehensive error handling
- ✅ DRY principle (no repeated logic)
- ✅ Maintainable pricing configuration

---

## 🎯 Key Takeaways

1. **Centralized pricing** makes maintenance easy
2. **Proper state management** prevents bugs
3. **Backend validation** ensures data integrity
4. **Clear data flow** simplifies debugging
5. **Comprehensive schemas** improve API clarity

Happy booking! 🧹✨
