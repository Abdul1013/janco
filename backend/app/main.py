from fastapi import FastAPI
from app.api.nearby_janitors import router as nearby_janitors_router  # ✅ alias matches below
from app.db.supabase_client import supabase  # Optional: for test route

app = FastAPI()

# Include the /nearby-janitors route
app.include_router(nearby_janitors_router)

@app.get("/")
def root():
    return {"message": "Hello from Co‑Janitors backend"}

@app.get("/test-connection")
def test_connection():
    user_data = supabase.table("profiles").select("*").limit(1).execute()
    return user_data.data


# from app.api.nearby_janitors import router as nearby_janitor_router
# from fastapi import FastAPI


# # from app.api import nearby_janitors
# from app.db.supabase_client import supabase
# app = FastAPI()

# # ?for multiple routes
# # for router in ( 
# #     nearby_janitors.router
# # ): 
#     # app.include_router(router)
    
# app.include_router(nearby_janitors_router)

# @app.get("/")
# def root():
#     return {"message": "Hello from Co-Janitors backend"}

# # @app.get("/test-connection")
# # def test_connection():
# #     user_data = supabase.table("profiles").select("*").limit(1).execute()
# #     return user_data.data
# # # https://youtube.com/shorts/uit_0Dx39pk?si=nALkO2x3lRIIubJn
# # @app.get("/items/{item_id}")
# # def read_item(item_id: int, q: Union[str, None] = None):
# #     return {"item_id": item_id, "q": q}

# # from fastapi import FastAPI, UploadFile, File, HttpException,
# # from fastapi.middlware.cors import CORSMiddleware
# # import shutil
# # import uuid
# # import os
# # import sv2
# # import numpy as numpy

# # app = FastAPI()

# # app.add_middleware(
# #   CORSMiddleware,
# #   allow_origins=["*"],
# #   allow_credentials=True,
# #   allow_methods=["*"],
# #   allow_headers=["*"]  
# # )

# # UPLOAD_DIR = "uploads"
# # os.makedirs(UPLOAD_DIR, exist_ok=True)

# # #calibrate later on using A4 opr a door 
# # REFERENCE_OBJECT_HEIGHT_M = 2.0 # 2 meters

# # @app.post("/estimate-area")
# # def estimate_area*(file: UploadFile = file(...)):
# #     try: 
# #         #save uploaded image
# #         extension = file.filename.split(".")[-1]
# #         filename= f"{uuid.uuid4().hex}.{extension}"

# # python3 -m venv venv
# # source venv/bin/activate
