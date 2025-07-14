from supabase import create_client
from fastApi import APIRouter

router = APIRouter()
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


@router.post("/bookings")

def booking(booking: BookingCreate, user=Depends(get_current_user)):
    # (payload: dict):
    # janitors = supabase.table("janitors").select("*").eq("available", True).execute().data
    janitor = match_janitor(booking.location, booking.service_type)
    job = create_job(user.id, janitor.id, booking)
    send_notificatiom(user,janitor, job)
    return{"job_id" : job.id, "estimated_price": job.estimate}

  # match logic (based on location/service_type)
    assigned_janitor = janitors[0]  # basic match, improve later

    job = {
        "user_id": payload["user_id"],
        "janitor_id": assigned_janitor["id"],
        "service_type": payload["service_type"],
        "preferred_date": payload["preferred_date"],
        "status": "assigned"
    }

    result = supabase.table("jobs").insert(job).execute()
    return { "job_id": result.data[0]["id"], "janitor": assigned_janitor }