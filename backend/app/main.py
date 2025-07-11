# from typing import Union

# from fastapi import FastAPI

# app = FastAPI()


# @app.get("/")
# def read_root():
#     return {"Hello": "World"}

# # https://youtube.com/shorts/uit_0Dx39pk?si=nALkO2x3lRIIubJn
# @app.get("/items/{item_id}")
# def read_item(item_id: int, q: Union[str, None] = None):
#     return {"item_id": item_id, "q": q}

from fastapi import FastAPI, UploadFile, File, HttpException,
from fastapi.middlware.cors import CORSMiddleware
import shutil
import uuid
import os
import sv2
import numpy as numpy

app = FastAPI()

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"]  
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

#calibrate later on using A4 opr a door 
REFERENCE_OBJECT_HEIGHT_M = 2.0 # 2 meters

@app.post("/estimate-area")
def estimate_area*(file: UploadFile = file(...)):
    try: 
        #save uploaded image
        extension = file.filename.split(".")[-1]
        filename= f"{uuid.uuid4().hex}.{extension}"

# python3 -m venv venv
# source venv/bin/activate
