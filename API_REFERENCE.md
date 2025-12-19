# API Endpoints Reference

## Base URL
```
http://localhost:8000  (development)
https://api.yourdomain.com  (production)
```

---

## Jobs Endpoints

### 1. Create Job (Internal)
```http
POST /jobs/create
Content-Type: application/json

{
  "user_id": "user-123",
  "janitor_id": null,
  "service_type": "house_cleaning",
  "scheduled_date": "2025-11-20",
  "scheduled_time": "10:00",
  "address": "123 Main St, Ibadan",
  "latitude": 7.3775,
  "longitude": 3.9470,
  "room_data": "[{\"room\":\"bedroom\",\"count\":3}]",
  "extras": "{\"kitchen\":true,\"livingRoom\":false}",
  "notes": "Please use hypoallergenic products"
}

Response:
{
  "message": "Job created successfully",
  "job": {
    "id": "job-123",
    "user_id": "user-123",
    "status": "pending",
    "payment_status": "unpaid",
    "created_at": "2025-11-16T10:30:00Z"
  }
}
```

---

### 2. Book Job with Janitor
```http
POST /jobs/book-job
Content-Type: application/json

{
  "user_id": "user-123",
  "janitor_id": "janitor-456",
  "service_type": "house_cleaning",
  "scheduled_time": "2025-11-20 10:00",
  "location": {
    "city": "Ibadan",
    "lat": 7.3775,
    "lng": 3.9470,
    "address_line": "123 Main St"
  },
  "metadata": {
    "priceEstimate": 35000,
    "breakdown": [
      "Standard House Cleaning (3-4 rooms): ₦35,000",
      "+ Kitchen Cleaning: ₦2,000"
    ],
    "notes": "Handle with care",
    "rooms": 3,
    "toilets": 1
  }
}

Response:
{
  "message": "Job booked successfully",
  "job": {
    "id": "job-123",
    "user_id": "user-123",
    "janitor_id": "janitor-456",
    "status": "confirmed",
    "payment_status": "pending",
    "created_at": "2025-11-16T10:30:00Z"
  },
  "success": true
}
```

---

### 3. Get Single Job
```http
GET /jobs/{job_id}

Response:
{
  "id": "job-123",
  "user_id": "user-123",
  "janitor_id": "janitor-456",
  "service_type": "house_cleaning",
  "status": "confirmed",
  "payment_status": "pending",
  "address": "123 Main St, Ibadan",
  "latitude": 7.3775,
  "longitude": 3.9470,
  "scheduled_date": "2025-11-20",
  "scheduled_time": "10:00",
  "created_at": "2025-11-16T10:30:00Z"
}
```

---

### 4. Get User's Jobs
```http
GET /jobs/user/{user_id}?status=pending

Query Parameters:
- status (optional): 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'

Response:
{
  "jobs": [
    {
      "id": "job-123",
      "service_type": "house_cleaning",
      "status": "confirmed",
      ...
    }
  ],
  "count": 1
}
```

---

### 5. Update Job Status
```http
PATCH /jobs/{job_id}?status=in_progress&payment_status=paid

Query Parameters:
- status (optional): 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'
- payment_status (optional): 'unpaid', 'pending', 'paid', 'failed'

Response:
{
  "message": "Job updated successfully",
  "job": {
    "id": "job-123",
    "status": "in_progress",
    "payment_status": "paid"
  }
}
```

---

### 6. Delete Job
```http
DELETE /jobs/{job_id}

Response:
{
  "message": "Job deleted successfully",
  "job_id": "job-123"
}
```

---

## Status Workflow

```
┌─────────┐
│ pending │  (Job created, awaiting janitor selection)
└────┬────┘
     │
     ↓
┌──────────┐
│confirmed │  (Janitor assigned, awaiting payment)
└────┬─────┘
     │
     ↓
┌───────────────┐
│  in_progress  │  (Janitor working on job)
└────┬──────────┘
     │
     ↓
┌───────────┐
│ completed │  (Job finished)
└───────────┘

Alternative: pending → cancelled (user cancels)
```

---

## Payment Status Workflow

```
unpaid → pending → paid (completed)
    ↓
  failed (retry)
```

---

## Example Frontend Calls

### JavaScript/React Native

```javascript
// Book a job
const bookJob = async () => {
  const response = await fetch('${API_BASE}/jobs/book-job', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      user_id: userId,
      janitor_id: selectedJanitorId,
      service_type: 'house_cleaning',
      scheduled_time: '2025-11-20 10:00',
      location: { lat, lng, address_line },
      metadata: { priceEstimate, breakdown, notes }
    })
  });
  
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail);
  return data.job;
};

// Get job status
const getJobStatus = async (jobId) => {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return response.json();
};

// Update job status
const updateJobStatus = async (jobId, newStatus) => {
  const response = await fetch(
    `${API_BASE}/jobs/${jobId}?status=${newStatus}`,
    {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );
  return response.json();
};
```

---

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Failed to create job"
}
```

### 404 Not Found
```json
{
  "detail": "Job not found"
}
```

### 500 Server Error
```json
{
  "detail": "Internal server error message"
}
```

---

## Service Types

- `house_cleaning` - Regular house cleaning
- `deep_cleaning` - Deep cleaning service
- `laundry` - Laundry service
- `fumigation` - Fumigation service

---

## Headers

### Required
```
Content-Type: application/json
```

### Optional (Auth)
```
Authorization: Bearer <access_token>
```

---

## Test Endpoints

### Test Database Connection
```http
GET /test-connection

Response:
{
  "status": "ok",
  "message": "Successfully connected to database",
  "sample_data_count": 5
}
```

### Root Endpoint
```http
GET /

Response:
{
  "status": "ok",
  "message": "Hello from Co‑Janitors backend"
}
```
