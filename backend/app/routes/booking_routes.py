"""
Booking routes for Co-Janitors
Handles job creation and janitor assignment
"""

from fastapi import APIRouter, HTTPException, Query
from app.services.supabase_service import supabase
from app.schema.job_schema import JobCreate, BookJobPayload, JobResponse
from datetime import datetime
import json

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.post("/create")
async def create_job(job: JobCreate):
    """Create a new job"""
    try:
        data = {
            "user_id": job.user_id,
            "janitor_id": job.janitor_id,
            "service_type": job.service_type,
            "scheduled_date": job.scheduled_date,
            "scheduled_time": job.scheduled_time,
            "address": job.address,
            "latitude": job.latitude,
            "longitude": job.longitude,
            "room_data": job.room_data,
            "extras": job.extras,
            "notes": job.notes,
            "status": "pending",
            "payment_status": "unpaid",
            "created_at": datetime.utcnow().isoformat(),
        }
        
        result = supabase.table("jobs").insert(data).execute()
        
        if not result.data:
            raise HTTPException(status_code=400, detail="Failed to create job")
        
        return {
            "message": "Job created successfully",
            "job": result.data[0]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/book-job")
async def book_job(payload: BookJobPayload):
    """Book a job with a specific janitor"""
    try:
        data = {
            "user_id": payload.user_id,
            "janitor_id": payload.janitor_id,
            "service_type": payload.service_type,
            "scheduled_time": payload.scheduled_time,
            "location": json.dumps(payload.location) if payload.location else None,
            "metadata": json.dumps(payload.metadata) if payload.metadata else None,
            "status": "confirmed",
            "payment_status": "pending",
            "created_at": datetime.utcnow().isoformat(),
        }
        
        result = supabase.table("jobs").insert(data).execute()
        
        if not result.data:
            raise HTTPException(status_code=400, detail="Failed to book job")
        
        job = result.data[0]
        
        return {
            "message": "Job booked successfully",
            "job": job,
            "success": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{job_id}")
async def get_job(job_id: str):
    """Get job by ID"""
    try:
        result = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}")
async def get_user_jobs(user_id: str, status: str = Query(None)):
    """Get all jobs for a user, optionally filtered by status"""
    try:
        query = supabase.table("jobs").select("*").eq("user_id", user_id)
        
        if status:
            query = query.eq("status", status)
        
        result = query.execute()
        
        return {
            "jobs": result.data,
            "count": len(result.data) if result.data else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{job_id}")
async def update_job_status(job_id: str, status: str = Query(None), payment_status: str = Query(None)):
    """Update job status"""
    try:
        update_data = {}
        
        if status:
            update_data["status"] = status
        if payment_status:
            update_data["payment_status"] = payment_status
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        result = supabase.table("jobs").update(update_data).eq("id", job_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Job not found or update failed")
        
        return {
            "message": "Job updated successfully",
            "job": result.data[0]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    """Delete a job (only if pending)"""
    try:
        # First check job status
        result = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Job not found")
        
        job = result.data
        
        if job.get("status") not in ["pending", "cancelled"]:
            raise HTTPException(status_code=400, detail="Can only delete pending or cancelled jobs")
        
        # Delete the job
        delete_result = supabase.table("jobs").delete().eq("id", job_id).execute()
        
        return {
            "message": "Job deleted successfully",
            "job_id": job_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
