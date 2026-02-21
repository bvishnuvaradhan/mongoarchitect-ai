from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import auth, schema, users, agent, compare_schema, export, advisor, evolution, query_latency, access_patterns, cost_estimation


app = FastAPI(title="MongoArchitect AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(schema.router)
app.include_router(compare_schema.router)
app.include_router(agent.router)
app.include_router(export.router)
app.include_router(advisor.router)
app.include_router(evolution.router)
app.include_router(query_latency.router)
app.include_router(access_patterns.router)
app.include_router(cost_estimation.router)


@app.get("/")
async def health_check():
    return {"status": "ok"}
