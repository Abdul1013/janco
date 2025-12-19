# ✅ Implementation Checklist

## Pre-Deployment Verification

### Frontend Code Review

- [ ] **BookingScreen.jsx**
  - [ ] `useJob()` hook is imported
  - [ ] `handleBookingSubmit()` function exists
  - [ ] `isBooking` state prevents double-submission
  - [ ] Validation errors show alerts
  - [ ] Navigation goes to "PriceEstimate" (correct name)
  - [ ] All data passed to next screen

- [ ] **PriceEstimateScreen.jsx**
  - [ ] `calculatePrice` imported from pricing.js
  - [ ] `useFixedPricing` is boolean (not string)
  - [ ] Switch renders correctly
  - [ ] Breakdown shows itemized costs
  - [ ] Total price formatted with ₦
  - [ ] Navigation to NearbyJanitors includes all params

- [ ] **pricing.js**
  - [ ] `calculatePrice()` exports
  - [ ] `calculateFixedPrice()` has all service types
  - [ ] `calculateDynamicPrice()` has all service types
  - [ ] `getFixedPriceBreakdown()` generates correct text
  - [ ] `getDynamicPriceBreakdown()` generates correct text
  - [ ] `formatPrice()` adds ₦ symbol
  - [ ] `getServiceLabel()` has all services

### Backend Code Review

- [ ] **booking_routes.py**
  - [ ] All 6 endpoints defined
  - [ ] POST /jobs/book-job validates input
  - [ ] Creates job with status "confirmed"
  - [ ] Returns job object
  - [ ] Error handling for duplicate janitors
  - [ ] GET endpoints include filtering

- [ ] **job_schema.py**
  - [ ] `JobCreate` model has all fields
  - [ ] `BookJobPayload` model validates
  - [ ] Type hints are correct
  - [ ] Optional fields marked properly
  - [ ] Imports are correct (Pydantic, datetime)

- [ ] **main.py**
  - [ ] `booking_routes` imported
  - [ ] Router included with `app.include_router()`
  - [ ] `/test-connection` returns proper response
  - [ ] CORS headers set correctly

### Database

- [ ] **Supabase Setup**
  - [ ] `jobs` table exists
  - [ ] Columns: id, user_id, janitor_id, service_type, status, payment_status, address, latitude, longitude, location, metadata, created_at, updated_at
  - [ ] Foreign keys set for user_id and janitor_id
  - [ ] Indexes on user_id and status
  - [ ] Row security policies enabled (if needed)

### Environment Configuration

- [ ] **Frontend .env**
  - [ ] SUPABASE_URL is set
  - [ ] SUPABASE_ANON_KEY is set
  - [ ] API_URL points to backend

- [ ] **Backend .env**
  - [ ] SUPABASE_URL is set
  - [ ] SUPABASE_KEY is set
  - [ ] DATABASE_URL is set (if using)

### Testing

- [ ] **Pricing Calculation**
  - [ ] Test fixed pricing with 1-2 rooms
  - [ ] Test fixed pricing with 3-4 rooms
  - [ ] Test fixed pricing with 5+ rooms
  - [ ] Test dynamic pricing calculations
  - [ ] Test with extras (kitchen, windows)
  - [ ] Test laundry pricing
  - [ ] Test fumigation pricing

- [ ] **UI/UX**
  - [ ] BookingScreen loads without errors
  - [ ] Can enter all fields
  - [ ] PriceEstimate calculates correctly
  - [ ] Can toggle pricing modes
  - [ ] Breakdown shows accurate items
  - [ ] Total price displays correctly
  - [ ] Navigation works end-to-end

- [ ] **API Endpoints**
  - [ ] GET /test-connection returns success
  - [ ] POST /jobs/create creates job
  - [ ] POST /jobs/book-job creates booking
  - [ ] GET /jobs/{id} retrieves job
  - [ ] GET /jobs/user/{user_id} lists user jobs
  - [ ] PATCH /jobs/{id} updates status
  - [ ] DELETE /jobs/{id} cancels job
  - [ ] Error cases return proper HTTP codes

- [ ] **Data Integrity**
  - [ ] User IDs are valid UUIDs
  - [ ] Janitor IDs are valid UUIDs
  - [ ] Prices are positive numbers
  - [ ] Status values are in allowed set
  - [ ] Metadata JSON is valid

### Performance

- [ ] **Frontend**
  - [ ] No console errors
  - [ ] Navigation transitions smooth
  - [ ] No memory leaks from polling
  - [ ] Images load properly

- [ ] **Backend**
  - [ ] Endpoints respond < 500ms
  - [ ] Database queries optimized
  - [ ] No N+1 queries
  - [ ] Error handling doesn't timeout

### Security

- [ ] **Authentication**
  - [ ] User must be authenticated for jobs
  - [ ] Can't access other users' jobs
  - [ ] Janitors can't modify user jobs

- [ ] **Input Validation**
  - [ ] All inputs validated on backend
  - [ ] SQL injection impossible (ORM used)
  - [ ] No sensitive data in logs
  - [ ] CORS headers restrict origins

- [ ] **Data Protection**
  - [ ] Passwords hashed
  - [ ] API keys not in code
  - [ ] Sensitive data encrypted

---

## Deployment Checklist

### Before Going Live

- [ ] All tests passing
- [ ] No console errors/warnings
- [ ] Code reviewed
- [ ] Documentation complete
- [ ] Staging environment tested
- [ ] Backup of database created
- [ ] Error monitoring set up (Sentry, etc)

### Production Deployment

- [ ] Update API_URL to production
- [ ] Use production Supabase keys
- [ ] Environment variables set on server
- [ ] SSL/HTTPS enabled
- [ ] Rate limiting configured
- [ ] Logging enabled
- [ ] Monitoring alerts set up

### Post-Deployment

- [ ] Test all endpoints on production
- [ ] Monitor error logs
- [ ] Check database for issues
- [ ] Verify users can complete bookings
- [ ] Monitor payment transactions
- [ ] Keep backup of live data

---

## Common Issues & Solutions

| Issue | Solution | Checklist |
|-------|----------|-----------|
| Switch state is string | Change default value to `true` | [ ] |
| Price calculation wrong | Check calculatePrice params | [ ] |
| 404 on PriceEstimate nav | Make sure screen name is exact | [ ] |
| API endpoint not found | Verify router imported in main.py | [ ] |
| Pricing utility not found | Check import path matches file | [ ] |
| Double submission | Add `isBooking` state | [ ] |
| Janitor not assigned | Check janitor_id passed to /book-job | [ ] |
| Cost breakdown empty | Ensure params include rooms/items count | [ ] |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-16 | Initial implementation |

---

## Support & Maintenance

### Regular Tasks

- [ ] Monitor pricing accuracy
- [ ] Track failed bookings
- [ ] Review user feedback
- [ ] Update pricing tiers as needed
- [ ] Backup database weekly

### Monthly Review

- [ ] Revenue tracking
- [ ] User growth metrics
- [ ] System performance
- [ ] Bug reports
- [ ] Feature requests

---

## Files to Monitor

These files control pricing and booking:

1. **App/utils/pricing.js** - Pricing logic
2. **App/screens/BookingScreen.jsx** - Booking UI
3. **App/screens/PriceEstimateScreen.jsx** - Pricing UI
4. **app/routes/booking_routes.py** - Backend booking
5. **app/schema/job_schema.py** - Data validation

---

## Emergency Procedures

### If Pricing is Wrong

1. Check `pricing.js` - FIXED_PRICES or DYNAMIC_RATES
2. Check PriceEstimateScreen - calculatePrice call
3. Check backend - metadata storage
4. Verify test cases with known inputs

### If Booking Fails

1. Check backend logs - /jobs/book-job endpoint
2. Check database connection - /test-connection
3. Check user/janitor IDs exist in Supabase
4. Check request payload format

### If App Crashes

1. Check console for errors
2. Check navigation params (PriceEstimate route)
3. Check state initialization
4. Check imports in screens

---

## Sign-Off

- [ ] Frontend developer: ____________________
- [ ] Backend developer: ____________________
- [ ] QA tester: ____________________
- [ ] Project manager: ____________________

---

**Ready to ship!** 🚀
