print("Importing FastAPI...")
from fastapi import FastAPI
print("Importing Pydantic...")
from pydantic import BaseModel, ConfigDict
print("Defining a model...")
class TestModel(BaseModel):
    name: str
print("OK")
