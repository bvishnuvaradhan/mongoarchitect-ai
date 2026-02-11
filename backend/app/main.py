from fastapi import FastAPI

app = FastAPI(title="MongoArchitect AI")

@app.get("/")
def root():
    return {"message": "MongoArchitect AI Backend Running 🚀"}
