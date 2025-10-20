from fastapi import APIRouter, HTTPException
from app.services.supabase_service import supabase
from app.schema.job_schema import JobCreate

router = APIRouter(prefix="/jobs", tags=["Jobs"])

@router.post("/create")
async def create_job(job: JobCreate):
    data= {
        "user_id": job.user_id,
        "janitor_id": job.janitor_id,
        "service_type": job.service_type,
        "status": "pending",
    }
    result = supabase.table("jobs").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create job")
    return {"message": "Job created", "job": result.data[0]}