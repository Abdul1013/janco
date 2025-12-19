from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import job_routes, chat_routes, janitor_routes, booking_routes
from app.db.supabase_client import supabase

app = FastAPI(title="Janco Backend", version="1.0")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(job_routes.router)
app.include_router(booking_routes.router)
app.include_router(chat_routes.router)
app.include_router(janitor_routes.router)

@app.get("/")
def root():
    return {"status": "ok", "message": "Hello from Co‑Janitors backend"}

@app.get("/test-connection")
def test_connection():
    try:
        user_data = supabase.table("profiles").select("*").limit(1).execute()
        return {
            "status": "ok",
            "message": "Successfully connected to database",
            "sample_data_count": len(user_data.data) if user_data.data else 0
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


